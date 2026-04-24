/**
 * POST /api/benchmark/runs/[a]/evaluate?b=<runBId>
 *
 * LLM-as-judge: compares two BenchmarkRun records via OpenRouter (Sonnet 4.6 default).
 * Idempotent per (runA, runB, judgeModel) — re-uses cached row unless force=true.
 *
 * Session 13 — benchmark judge endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  judgeVerdictSchema,
  type JudgeVerdict,
  type JudgeErrorVerdict,
} from "@/lib/benchmark-judge-schema";
import type { BenchmarkType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-4.6";
const OPENROUTER_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
// ~8K tokens ≈ ~32K chars — conservative estimate for mixed EN/PT content.
const OUTPUT_CHAR_LIMIT = 28_000;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const requestBodySchema = z.object({
  judgeModel: z.string().optional(),
  force: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Output extraction helpers
//
// Each benchmark type stores results differently inside run.response.
// We normalise to a plain string for the judge prompt.
// ---------------------------------------------------------------------------

interface RunResponse {
  result?: unknown;
  [key: string]: unknown;
}

function extractQaOutput(response: RunResponse): string {
  // QA result shape: { answer: string; ... } or plain string
  const result = response.result;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.answer === "string") return r.answer;
    // Fallback: JSON dump so the judge has something to work with
    return JSON.stringify(r, null, 2);
  }
  return "[no result]";
}

function extractIdeationOutput(response: RunResponse): string {
  // Ideation result shape: { ideas: Array<{ title, description, ... }> }
  const result = response.result;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.ideas)) {
      return r.ideas
        .map((idea: unknown, i: number) => {
          if (!idea || typeof idea !== "object") return `${i + 1}. [malformed]`;
          const it = idea as Record<string, unknown>;
          return `${i + 1}. ${it.title ?? "untitled"}\n${it.description ?? ""}`.trim();
        })
        .join("\n\n");
    }
    return JSON.stringify(r, null, 2);
  }
  return "[no result]";
}

function extractContentGenOutput(response: RunResponse): string {
  // Content generation result: { sections: Array<{ title, content: { "pt-br", en } }> }
  const result = response.result;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.sections)) {
      return r.sections
        .map((sec: unknown) => {
          if (!sec || typeof sec !== "object") return "";
          const s = sec as Record<string, unknown>;
          const heading = s.title ?? s.sectionId ?? "Section";
          const content = s.content as Record<string, unknown> | string | undefined;
          const body =
            typeof content === "string"
              ? content
              : content?.["pt-br"] ?? content?.en ?? JSON.stringify(content);
          return `## ${heading}\n${body}`;
        })
        .join("\n\n");
    }
    return JSON.stringify(r, null, 2);
  }
  return "[no result]";
}

/**
 * Extracts the textual output from a run's response field.
 * Truncates with a note if the output exceeds OUTPUT_CHAR_LIMIT.
 */
function extractRunOutput(type: BenchmarkType, response: unknown): string {
  const res = (response ?? {}) as RunResponse;
  let text: string;

  switch (type) {
    case "qa":
      text = extractQaOutput(res);
      break;
    case "ideation":
      text = extractIdeationOutput(res);
      break;
    case "content_generation":
      text = extractContentGenOutput(res);
      break;
    default:
      text = JSON.stringify(res.result ?? res, null, 2);
  }

  if (text.length <= OUTPUT_CHAR_LIMIT) return text;
  return (
    text.slice(0, OUTPUT_CHAR_LIMIT) +
    `\n\n[...truncated — original length: ${text.length} chars]`
  );
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior editor specialising in Path of Exile content.
You are evaluating two AI-generated outputs (A and B) for the same task briefing.

Return a JSON object with EXACTLY this shape — no markdown, no wrapping, raw JSON only:
{
  "winner": "A" | "B" | "tie",
  "dimensions": {
    "factualAccuracy": { "winner": "A" | "B" | "tie", "rationale": "<string>" },
    "proseQuality":    { "winner": "A" | "B" | "tie", "rationale": "<string>" },
    "structure":       { "winner": "A" | "B" | "tie", "rationale": "<string>" },
    "poeDomainKnowledge": { "winner": "A" | "B" | "tie", "rationale": "<string>" },
    "antiHallucination":  { "winner": "A" | "B" | "tie", "rationale": "<string>" }
  },
  "overallRationale": "<string>",
  "confidence": "low" | "medium" | "high"
}

Evaluation criteria:
- factualAccuracy: are game mechanics, item names, and numbers correct?
- proseQuality: clarity, readability, tone appropriate for PoE players.
- structure: logical flow, headings, paragraph organisation.
- poeDomainKnowledge: depth of PoE-specific insight (builds, economy, league mechanics).
- antiHallucination: does the output avoid making up items, numbers, or mechanics?

Be concise but specific in rationales. Do NOT hallucinate winner fields.`;

function buildUserPrompt(params: {
  briefing: string;
  modelA: string;
  outputA: string;
  modelB: string;
  outputB: string;
}): string {
  return [
    `Briefing / Task:\n${params.briefing}`,
    `---`,
    `Output A (model: ${params.modelA}):\n${params.outputA}`,
    `---`,
    `Output B (model: ${params.modelB}):\n${params.outputB}`,
    `---`,
    `Evaluate the two outputs and return the JSON verdict.`,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// OpenRouter call
// ---------------------------------------------------------------------------

interface OpenRouterUsage {
  total_cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: OpenRouterUsage;
}

async function callOpenRouter(params: {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<{ rawText: string; costUsd: number }> {
  const res = await fetch(OPENROUTER_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userMessage },
      ],
      response_format: { type: "json_object" },
      usage: { include: true },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter returned ${res.status}: ${errText}`);
  }

  const data: OpenRouterResponse = await res.json();
  const rawText = data.choices?.[0]?.message?.content ?? "";
  const costUsd = data.usage?.total_cost ?? 0;

  return { rawText, costUsd };
}

// ---------------------------------------------------------------------------
// Verdict parsing with one retry
// ---------------------------------------------------------------------------

function parseVerdict(rawText: string): JudgeVerdict | null {
  try {
    const parsed = JSON.parse(rawText);
    const result = judgeVerdictSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

interface EvaluationResult {
  verdict: JudgeVerdict | JudgeErrorVerdict;
  winner: string | null;
  costUsd: number;
}

async function runJudge(params: {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<EvaluationResult> {
  // First attempt
  const first = await callOpenRouter(params);
  const verdictFirst = parseVerdict(first.rawText);

  if (verdictFirst) {
    return { verdict: verdictFirst, winner: verdictFirst.winner, costUsd: first.costUsd };
  }

  // One retry on malformed JSON
  const second = await callOpenRouter(params);
  const verdictSecond = parseVerdict(second.rawText);
  const totalCost = first.costUsd + second.costUsd;

  if (verdictSecond) {
    return { verdict: verdictSecond, winner: verdictSecond.winner, costUsd: totalCost };
  }

  // Both attempts failed — persist an error record for audit
  const errorVerdict: JudgeErrorVerdict = {
    error: "judge returned invalid JSON",
    raw: second.rawText.slice(0, 2000), // cap stored raw for DB size
  };
  return { verdict: errorVerdict, winner: null, costUsd: totalCost };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ a: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[benchmark/evaluate] OPENROUTER_API_KEY is not set");
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY environment variable is not configured" },
      { status: 500 },
    );
  }

  const { a: runAId } = await params;
  const { searchParams } = request.nextUrl;
  const runBId = searchParams.get("b");

  if (!runBId) {
    return NextResponse.json({ error: "Query param ?b=<runBId> is required" }, { status: 400 });
  }

  // Parse optional body
  let judgeModel = DEFAULT_JUDGE_MODEL;
  let force = false;

  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = requestBodySchema.safeParse(raw);
    if (parsed.success) {
      if (parsed.data.judgeModel) judgeModel = parsed.data.judgeModel;
      if (parsed.data.force !== undefined) force = parsed.data.force;
    }
  } catch {
    // body is optional — proceed with defaults
  }

  // Idempotency check — return cached row unless force=true
  if (!force) {
    const cached = await prisma.benchmarkEvaluation.findUnique({
      where: { runAId_runBId_judgeModel: { runAId, runBId, judgeModel } },
    });
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }
  }

  // Fetch both runs in parallel
  const [runA, runB] = await Promise.all([
    prisma.benchmarkRun.findUnique({ where: { id: runAId } }),
    prisma.benchmarkRun.findUnique({ where: { id: runBId } }),
  ]);

  if (!runA) {
    return NextResponse.json({ error: `Run A not found: ${runAId}` }, { status: 404 });
  }
  if (!runB) {
    return NextResponse.json({ error: `Run B not found: ${runBId}` }, { status: 404 });
  }

  if (runA.type !== runB.type) {
    return NextResponse.json(
      { error: `Type mismatch: run A is "${runA.type}" but run B is "${runB.type}"` },
      { status: 400 },
    );
  }

  // Extract textual outputs
  const outputA = extractRunOutput(runA.type, runA.response);
  const outputB = extractRunOutput(runB.type, runB.response);

  // Build briefing string from the requestBody stored on run A (canonical)
  const briefingText =
    typeof runA.requestBody === "object" && runA.requestBody !== null
      ? JSON.stringify(runA.requestBody, null, 2)
      : String(runA.requestBody);

  const modelA =
    typeof runA.modelOverrides === "object" && runA.modelOverrides !== null
      ? JSON.stringify(runA.modelOverrides)
      : "default";
  const modelB =
    typeof runB.modelOverrides === "object" && runB.modelOverrides !== null
      ? JSON.stringify(runB.modelOverrides)
      : "default";

  const userMessage = buildUserPrompt({
    briefing: briefingText,
    modelA,
    outputA,
    modelB,
    outputB,
  });

  const { verdict, winner, costUsd } = await runJudge({
    model: judgeModel,
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
  });

  // Upsert so force=true overwrites an existing row
  const evaluation = await prisma.benchmarkEvaluation.upsert({
    where: { runAId_runBId_judgeModel: { runAId, runBId, judgeModel } },
    create: {
      runAId,
      runBId,
      judgeModel,
      verdict: verdict as object,
      winner,
      costUsd,
    },
    update: {
      verdict: verdict as object,
      winner,
      costUsd,
    },
  });

  return NextResponse.json(evaluation, { status: 200 });
}
