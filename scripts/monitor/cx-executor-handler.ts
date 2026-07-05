/**
 * Currency Exchange — Executor connection handler
 *
 * Endpoint: /ws/executor  (novo, ao lado de /ws/agent e /ws/dashboard)
 *
 * O cx-executor local (Python, espelha o agent.py) conecta aqui, reporta
 * fills detectados in-game pelo plugin e recebe COMANDOS da fila cx_job:
 *   executor -> VPS:  register · heartbeat · fill_report · command_ack · logs ·
 *                     param_state · disconnect
 *   VPS -> executor:  fill_ack · command {id, cmd, args}
 *
 * Um fill_report casa com o fill "open"/"holding" criado pela UI ("Fazer Order")
 * e preenche a perna correspondente via prisma direto (server-side, sem auth REST).
 *
 * Presença é persistida em cx_executor; a fila cx_job é drenada a cada ~2s
 * (status=pending de executor online, priority desc, createdAt asc).
 */

import { appendFile } from "node:fs/promises";
import { WebSocket } from "ws";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { deriveStatus, derivePnl, type FillLegs } from "../../lib/fills.js";
import {
  applyRemoteMetrics,
  cxDecisionsTotal,
  cxExecutorsOnline,
  cxFillReportsTotal,
  cxJobLatencySeconds,
  cxWsMessagesTotal,
} from "./cx-metrics.js";
import type { RemoteMetricsPayload } from "./cx-metrics-remote.js";

// ============================================================
// Protocolo
// ============================================================

export interface FillReportData {
  item: string;
  league: string;
  base?: string; // default "Chaos Orb"
  side: "buy" | "sell";
  ratio?: number | null; // preço executado (base/item)
  qty?: number | null; // quantidade que encheu
  filledAt?: string | null; // ISO; default = agora
  qAhead?: number | null; // fila à frente no post (calibração)
}

interface CommandAckData {
  id: string;
  status: "acked" | "done" | "failed";
  result?: unknown;
  error?: string;
}

interface ExecutorLogEntry {
  level?: string;
  message?: string;
  ts?: string;
  meta?: unknown;
}

/** Decisão de trading reportada pelo executor (regra/LLM/manual). */
interface DecisionData {
  ts?: string;
  source?: string; // rule|llm|manual
  mode?: string; // manual|semi|full
  item?: string;
  league?: string;
  action?: string;
  reason?: string;
  snapshot?: unknown;
}

type ExecutorMessage =
  | { type: "register"; executorId: string; pcName?: string; data?: { capabilities?: string[]; league?: string } }
  | { type: "heartbeat"; executorId: string }
  | { type: "fill_report"; executorId: string; pcName?: string; data: FillReportData }
  | ({ type: "command_ack"; executorId: string } & CommandAckData)
  | { type: "logs"; executorId: string; entries?: ExecutorLogEntry[]; data?: { entries?: ExecutorLogEntry[] } }
  | { type: "param_state"; executorId: string; params?: unknown }
  | ({ type: "metrics"; executorId: string; ts?: string } & RemoteMetricsPayload)
  | ({ type: "decision"; executorId: string } & DecisionData)
  | { type: "validate_request"; executorId?: string; id: string; league?: string; items?: string[] }
  | { type: "decision_request"; executorId?: string; id: string; league?: string }
  | {
      type: "sanitize_request";
      executorId?: string;
      id: string;
      league?: string;
      state?: SanitizeState;
      thresholds?: SanitizeThresholds;
    }
  | { type: "book_report"; executorId?: string; lines?: unknown[] }
  | { type: "disconnect"; executorId: string };

/** Estado do board que o executor manda pra VPS decidir F1/F2/F3 (shape = cx_policy.build_executor_state). */
interface SanitizeState {
  counter?: { cur?: number; max?: number };
  orders?: Array<{
    orderKey?: string; item?: string; side?: string;
    ageMin?: number; fillPct?: number; undercut?: boolean; priceBaseItem?: number;
  }>;
  positions?: Array<{
    item?: string; net?: number; avgBuyRatio?: number; base?: string;
    hasOpenSell?: boolean; idleMin?: number;
  }>;
}
interface SanitizeThresholds {
  stock_idle_min?: number; stale_min?: number; dead_min?: number;
  min_margin_pct?: number; strategy?: Record<string, string>;
  sell_stale_min?: number; sell_min_margin_pct?: number;
}

/** Tipos conhecidos — limita a cardinalidade do label {type} no prom. */
const KNOWN_MESSAGE_TYPES = new Set([
  "register",
  "heartbeat",
  "fill_report",
  "command_ack",
  "logs",
  "param_state",
  "metrics",
  "decision",
  "validate_request",
  "decision_request",
  "sanitize_request",
  "book_report",
  "disconnect",
]);

interface ExecutorInfo {
  executorId: string;
  pcName: string | null;
  league: string | null;
  lastSeen: string;
  isOnline: boolean;
  fillsApplied: number;
}

/** Máximo de entradas de log aceitas por mensagem "logs" */
const LOGS_BATCH_CAP = 100;

/** Intervalo do drain da fila cx_job */
const JOB_DRAIN_INTERVAL_MS = 2_000;

// Presença em memória (espelho leve; a fonte persistida é cx_executor).
const executors = new Map<string, ExecutorInfo>();

// Conexões vivas — necessário pro caminho VPS -> executor (comandos).
const executorSockets = new Map<string, WebSocket>();

export function getExecutors(): ExecutorInfo[] {
  return Array.from(executors.values());
}

/** Envia uma mensagem pro executor, se conectado. Retorna false se offline. */
export function sendToExecutor(executorId: string, msg: unknown): boolean {
  const ws = executorSockets.get(executorId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

// ============================================================
// Conexão
// ============================================================

export function handleExecutorConnection(ws: WebSocket): void {
  let executorId: string | null = null;

  ws.on("message", async (raw) => {
    let msg: ExecutorMessage;
    try {
      const parsed = JSON.parse(raw.toString());
      // Python manda snake_case — normaliza os campos-chave.
      msg = {
        ...parsed,
        executorId: parsed.executorId ?? parsed.executor_id,
        pcName: parsed.pcName ?? parsed.pc_name,
      } as ExecutorMessage;
    } catch {
      console.warn("[CX-Exec] JSON inválido — ignorando");
      return;
    }

    executorId = msg.executorId ?? null;

    cxWsMessagesTotal.inc({
      type: KNOWN_MESSAGE_TYPES.has(msg.type) ? msg.type : "unknown",
    });

    try {
      switch (msg.type) {
        case "register":
          await handleRegister(ws, msg);
          break;
        case "heartbeat":
          await touch(msg.executorId);
          break;
        case "fill_report": {
          const res = await applyFillReport(msg.data);
          await touch(msg.executorId);
          const inst = executors.get(msg.executorId);
          if (inst && res.ok) inst.fillsApplied++;
          if (res.ok && (msg.data.side === "buy" || msg.data.side === "sell")) {
            cxFillReportsTotal.inc({ side: msg.data.side });
          }
          // eco de confirmação pro executor (idempotência/log local)
          safeSend(ws, { type: "fill_ack", ok: res.ok, fillId: res.fillId, reason: res.reason });
          break;
        }
        case "command_ack":
          await handleCommandAck(msg);
          break;
        case "logs":
          await handleLogs(msg);
          break;
        case "param_state":
          // opcional nesta fase — só registra no console do servidor
          console.log(`[CX-Exec] param_state de ${msg.executorId}:`, JSON.stringify(msg.params ?? {}));
          break;
        case "metrics":
          handleMetrics(msg);
          break;
        case "decision":
          await handleDecision(msg);
          break;
        case "validate_request":
          await handleValidateRequest(ws, msg);
          break;
        case "decision_request":
          await handleDecisionRequest(ws, msg);
          break;
        case "sanitize_request":
          await handleSanitizeRequest(ws, msg);
          break;
        case "book_report":
          await handleBookReport(msg);
          await touch(msg.executorId ?? "");
          break;
        case "disconnect":
          await markOffline(msg.executorId);
          break;
        default:
          console.warn(`[CX-Exec] tipo desconhecido: ${(msg as { type: string }).type}`);
      }
    } catch (err) {
      console.error(`[CX-Exec] erro no tipo "${msg.type}":`, err);
    }
  });

  ws.on("close", () => {
    if (executorId) {
      if (executorSockets.get(executorId) === ws) {
        executorSockets.delete(executorId);
      }
      lastPlanKey.delete(executorId);
      markOffline(executorId).catch(() => {});
    }
  });

  ws.on("error", (err) => {
    console.error("[CX-Exec WS] erro:", err.message);
  });
}

async function handleRegister(
  ws: WebSocket,
  msg: Extract<ExecutorMessage, { type: "register" }>
): Promise<void> {
  const now = new Date();
  executors.set(msg.executorId, {
    executorId: msg.executorId,
    pcName: msg.pcName ?? null,
    league: msg.data?.league ?? executors.get(msg.executorId)?.league ?? null,
    lastSeen: now.toISOString(),
    isOnline: true,
    fillsApplied: executors.get(msg.executorId)?.fillsApplied ?? 0,
  });
  executorSockets.set(msg.executorId, ws);
  updateExecutorsOnlineGauge();
  console.log(`[CX-Exec] registrado: ${msg.executorId} (${msg.pcName ?? "?"}) caps=${msg.data?.capabilities ?? []}`);

  const capabilities = msg.data?.capabilities ?? [];
  const league = msg.data?.league ?? null;
  try {
    await prisma.cxExecutor.upsert({
      where: { executorId: msg.executorId },
      update: {
        pcName: msg.pcName ?? undefined,
        league: league ?? undefined,
        capabilities,
        isOnline: true,
        lastSeen: now,
        connectedAt: now,
      },
      create: {
        executorId: msg.executorId,
        pcName: msg.pcName ?? null,
        league,
        capabilities,
        isOnline: true,
        lastSeen: now,
        connectedAt: now,
      },
    });
  } catch (err) {
    console.error(`[CX-Exec] upsert cx_executor falhou (${msg.executorId}):`, err);
  }

  // snapshot do plano na conexão (o resto vem pelo push do drain)
  void pushPlanTo(msg.executorId, true);
}

/** Sincroniza o gauge cx_executors_online com a presença em memória. */
function updateExecutorsOnlineGauge(): void {
  let online = 0;
  for (const inst of executors.values()) if (inst.isOnline) online++;
  cxExecutorsOnline.set(online);
}

async function touch(executorId: string): Promise<void> {
  const now = new Date();
  const inst = executors.get(executorId);
  if (inst) {
    inst.lastSeen = now.toISOString();
    inst.isOnline = true;
    updateExecutorsOnlineGauge();
  }
  try {
    await prisma.cxExecutor.updateMany({
      where: { executorId },
      data: { isOnline: true, lastSeen: now },
    });
  } catch (err) {
    console.error(`[CX-Exec] touch cx_executor falhou (${executorId}):`, err);
  }
}

async function markOffline(executorId: string): Promise<void> {
  const inst = executors.get(executorId);
  if (inst) {
    inst.isOnline = false;
    updateExecutorsOnlineGauge();
    console.log(`[CX-Exec] offline: ${executorId}`);
  }
  try {
    await prisma.cxExecutor.updateMany({
      where: { executorId },
      data: { isOnline: false, lastSeen: new Date() },
    });
  } catch (err) {
    console.error(`[CX-Exec] markOffline cx_executor falhou (${executorId}):`, err);
  }
}

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ============================================================
// Command channel — ack de comandos e logs remotos
// ============================================================

async function handleCommandAck(
  msg: Extract<ExecutorMessage, { type: "command_ack" }>
): Promise<void> {
  if (!msg.id || !["acked", "done", "failed"].includes(msg.status)) {
    console.warn(`[CX-Exec] command_ack inválido:`, JSON.stringify(msg));
    return;
  }
  const now = new Date();
  const data: Prisma.CxJobUpdateManyMutationInput = { status: msg.status };
  if (msg.status === "acked") {
    data.ackedAt = now;
  } else {
    // done|failed
    data.doneAt = now;
    if (msg.result !== undefined) data.result = msg.result as Prisma.InputJsonValue;
    if (msg.error !== undefined) data.error = String(msg.error);
  }
  try {
    const updated = await prisma.cxJob.updateMany({
      where:
        msg.status === "acked"
          ? { id: msg.id, status: "sent" }
          : { id: msg.id, status: { in: ["sent", "acked"] } },
      data,
    });
    if (updated.count === 0) {
      console.warn(`[CX-Exec] command_ack pra job desconhecido/estado inválido: ${msg.id} (${msg.status})`);
    } else {
      console.log(`[CX-Exec] job ${msg.id} -> ${msg.status}${msg.error ? ` (${msg.error})` : ""}`);
      // latência total do job (createdAt -> doneAt) no fechamento
      if (msg.status === "done" || msg.status === "failed") {
        const job = await prisma.cxJob.findUnique({
          where: { id: msg.id },
          select: { createdAt: true },
        });
        if (job) {
          cxJobLatencySeconds.observe((now.getTime() - job.createdAt.getTime()) / 1000);
        }
      }
    }
  } catch (err) {
    console.error(`[CX-Exec] update cx_job falhou (${msg.id}):`, err);
  }
}

// ============================================================
// Telemetria — métricas remotas e trilha de decisões
// ============================================================

/**
 * {"type":"metrics", counters:[{name,labels,value}], gauges:[...]}
 * Re-expõe no /metrics com labels extras {executor_id, league}. Validação
 * (nome ^[a-z_][a-z0-9_]*$, cap de 100 séries/executor) em cx-metrics-remote.
 */
function handleMetrics(
  msg: Extract<ExecutorMessage, { type: "metrics" }>
): void {
  const league = executors.get(msg.executorId)?.league ?? null;
  applyRemoteMetrics(msg.executorId, league, msg);
}

/**
 * {"type":"decision", ts, source, mode, item, league, action, reason, snapshot}
 * -> INSERT em cx_decision_log + counter cx_decisions_total{action,mode}.
 * `mode` não tem coluna própria — vai junto no snapshot.
 */
async function handleDecision(
  msg: Extract<ExecutorMessage, { type: "decision" }>
): Promise<void> {
  const action = typeof msg.action === "string" && msg.action ? msg.action : null;
  const reason = typeof msg.reason === "string" ? msg.reason : "";
  if (!action) {
    console.warn(`[CX-Exec] decision sem action de ${msg.executorId} — ignorando`);
    return;
  }
  const mode = typeof msg.mode === "string" && msg.mode ? msg.mode : "unknown";
  const source = typeof msg.source === "string" && msg.source ? msg.source : "rule";

  cxDecisionsTotal.inc({ action, mode });

  // mode entra no snapshot (a tabela não tem coluna dedicada)
  let snapshot: Prisma.InputJsonValue | undefined;
  if (msg.snapshot && typeof msg.snapshot === "object" && !Array.isArray(msg.snapshot)) {
    snapshot = { mode, ...(msg.snapshot as Record<string, unknown>) } as Prisma.InputJsonValue;
  } else if (msg.snapshot !== undefined) {
    snapshot = { mode, value: msg.snapshot } as Prisma.InputJsonValue;
  } else {
    snapshot = { mode } as Prisma.InputJsonValue;
  }

  const ts = msg.ts ? new Date(msg.ts) : null;
  try {
    await prisma.cxDecisionLog.create({
      data: {
        executorId: msg.executorId,
        source,
        item: typeof msg.item === "string" ? msg.item : null,
        league: typeof msg.league === "string" ? msg.league : null,
        action,
        reason,
        snapshot,
        createdAt: ts && !Number.isNaN(ts.getTime()) ? ts : undefined,
      },
    });
  } catch (err) {
    console.error(`[CX-Exec] insert cx_decision_log falhou (${msg.executorId}):`, err);
  }
}

async function handleLogs(
  msg: Extract<ExecutorMessage, { type: "logs" }>
): Promise<void> {
  const entries = (msg.entries ?? msg.data?.entries ?? []).slice(0, LOGS_BATCH_CAP);
  if (entries.length === 0) return;
  const rows = entries
    .filter((e) => e && typeof e.message === "string")
    .map((e) => ({
      executorId: msg.executorId,
      level: typeof e.level === "string" ? e.level : "info",
      message: e.message as string,
      meta: e.meta === undefined ? undefined : (e.meta as Prisma.InputJsonValue),
      ts: e.ts ? new Date(e.ts) : new Date(),
    }));
  if (rows.length === 0) return;
  try {
    await prisma.cxLog.createMany({ data: rows });
  } catch (err) {
    console.error(`[CX-Exec] insert cx_log falhou (${msg.executorId}):`, err);
  }
}

// ============================================================
// Drain da fila cx_job — pending -> command no socket -> sent
// ============================================================

let drainTimer: ReturnType<typeof setInterval> | null = null;
let draining = false;

/**
 * Inicia o loop que drena a fila cx_job: a cada ~2s, pros executores com
 * socket aberto, pega jobs pending (priority desc, createdAt asc), envia
 * {type:"command", id, cmd, args} e marca status=sent.
 */
export function startCxJobDrain(): void {
  if (drainTimer) return;
  drainTimer = setInterval(() => {
    void drainJobs();
    void pushPlans();   // entrega o cx_order_plan pelo MESMO WS (sem DB na ponta)
  }, JOB_DRAIN_INTERVAL_MS);
  console.log(`[CX-Exec] drain da fila cx_job ativo (${JOB_DRAIN_INTERVAL_MS}ms)`);
}

async function drainJobs(): Promise<void> {
  if (draining) return; // evita sobreposição se o banco demorar
  draining = true;
  try {
    const onlineIds = Array.from(executorSockets.entries())
      .filter(([, ws]) => ws.readyState === WebSocket.OPEN)
      .map(([id]) => id);
    if (onlineIds.length === 0) return;

    const jobs = await prisma.cxJob.findMany({
      where: { status: "pending", executorId: { in: onlineIds } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 50,
    });

    for (const job of jobs) {
      const sent = sendToExecutor(job.executorId, {
        type: "command",
        id: job.id,
        cmd: job.type,
        args: job.payload ?? {},
      });
      if (!sent) continue; // socket caiu entre o findMany e o send — fica pending
      await prisma.cxJob.update({
        where: { id: job.id },
        data: { status: "sent", sentAt: new Date() },
      });
      console.log(`[CX-Exec] -> command ${job.type} (job ${job.id}) p/ ${job.executorId}`);
    }
  } catch (err) {
    console.error("[CX-Exec] drainJobs falhou:", err);
  } finally {
    draining = false;
  }
}

// ============================================================
// Plano (push) — entrega o cx_order_plan pelo MESMO WS (sem DB na ponta do executor)
// ============================================================

interface PlanRow {
  item: string;
  base: string;
  buy_ratio: unknown;
  sell_ratio: unknown;
  qty: unknown;
  exp_profit_c: unknown;
  exp_profit_div: unknown;
  p_fill: unknown;
  priority: unknown;
  slot_class: string | null;
  created_at: Date;
}

// executorId -> generatedAt já empurrado (evita re-enviar o mesmo plano a cada 2s)
const lastPlanKey = new Map<string, string>();

async function readPlan(league: string) {
  // cx_order_plan é tabela do worker (não é model Prisma) -> query cru parametrizado
  const rows = await prisma.$queryRaw<PlanRow[]>(Prisma.sql`
    select item, base, buy_ratio, sell_ratio, qty, exp_profit_c, exp_profit_div,
           p_fill, priority, slot_class, created_at
    from cx_order_plan where league = ${league} order by priority`);
  if (!rows || rows.length === 0) return null;
  let gen = rows[0].created_at;
  for (const r of rows) if (r.created_at > gen) gen = r.created_at;
  return {
    league,
    generatedAt: new Date(gen).toISOString(),
    orders: rows.map((r) => ({
      priority: Number(r.priority),
      item: r.item,
      base: r.base,
      buyRatio: Number(r.buy_ratio),
      sellRatio: Number(r.sell_ratio),
      qty: Number(r.qty),
      expProfitC: r.exp_profit_c == null ? null : Number(r.exp_profit_c),
      expProfitDiv: r.exp_profit_div == null ? null : Number(r.exp_profit_div),
      pFill: r.p_fill == null ? null : Number(r.p_fill),
      class: r.slot_class,
    })),
  };
}

/** Empurra o plano pro executor se mudou (ou force). Silencioso se a tabela não existe ainda. */
async function pushPlanTo(executorId: string, force = false): Promise<void> {
  const league = executors.get(executorId)?.league;
  if (!league) return;
  try {
    const plan = await readPlan(league);
    if (!plan) return;
    if (!force && lastPlanKey.get(executorId) === plan.generatedAt) return;
    if (sendToExecutor(executorId, { type: "plan", ...plan })) {
      lastPlanKey.set(executorId, plan.generatedAt);
    }
  } catch {
    // cx_order_plan pode não existir (tabela do worker) — ignora silenciosamente
  }
}

async function pushPlans(): Promise<void> {
  for (const [id, ws] of executorSockets.entries()) {
    if (ws.readyState === WebSocket.OPEN) await pushPlanTo(id);
  }
}

// ============================================================
// Value-check v2 (RPC) — bid/ask fresco do cx_signal pelo MESMO WS
// ============================================================

async function handleValidateRequest(
  ws: WebSocket,
  msg: Extract<ExecutorMessage, { type: "validate_request" }>
): Promise<void> {
  const books: Record<string, [number, number]> = {};
  try {
    const items = (msg.items ?? []).filter((x): x is string => typeof x === "string");
    if (msg.league && items.length) {
      const rows = await prisma.cxSignal.findMany({
        where: { league: msg.league, item: { in: items } },
        select: { item: true, bid: true, ask: true },
      });
      for (const r of rows) {
        if (r.bid != null && r.ask != null) books[r.item] = [Number(r.bid), Number(r.ask)];
      }
    }
  } catch (err) {
    console.error("[CX-Exec] validate_request falhou:", err);
  }
  safeSend(ws, { type: "validate_response", id: msg.id, books });
}

// ============================================================
// Decisão-sob-demanda (RPC) — plano VIVO por-fill + exploração (epsilon-greedy)
// O executor pede a cada fill "o que faço agora?"; o servidor decide FRESCO (não re-posta
// o plano estático). v1: plano do allocator + exploração. v2 (depois): state-aware + cancel.
// ============================================================

type DecOrder = { class?: string | null; [k: string]: unknown };

/** epsilon-greedy: com prob EPS troca ~SWAPS slots ATIVOS por itens da FILA — testa itens
 *  diferentes / margem-baixa em vez de re-postar sempre o mesmo top. Deixa o plano NÃO-estático. */
function applyExploration<T extends { orders: DecOrder[] }>(plan: T): T {
  const EPS = 0.3, SWAPS = 2;
  if (Math.random() >= EPS) return plan;
  const orders = plan.orders.map((o) => ({ ...o }));
  const active = orders.filter((o) => o.class === "active");
  const queue = orders.filter((o) => o.class === "queue");
  const n = Math.min(SWAPS, active.length, queue.length);
  if (n < 1) return plan;
  for (let i = 0; i < n; i++) active[active.length - 1 - i].class = "queue";   // rebaixa os piores ativos
  const picks = queue.sort(() => Math.random() - 0.5).slice(0, n);
  for (const q of picks) q.class = "active";                                    // promove itens da fila (exploração)
  const swaps = picks
    .map((q) => (typeof q.item === "string" ? q.item : null))
    .filter((x): x is string => !!x);                                           // itens testados (pra auditar depois)
  return { ...plan, orders, explored: true, swaps };
}

async function handleDecisionRequest(
  ws: WebSocket,
  msg: Extract<ExecutorMessage, { type: "decision_request" }>
): Promise<void> {
  let plan: Awaited<ReturnType<typeof readPlan>> | null = null;
  try {
    const p = msg.league ? await readPlan(msg.league) : null;
    if (p) plan = applyExploration(p);
  } catch (err) {
    console.error("[CX-Exec] decision_request falhou:", err);
  }
  const act = plan ? plan.orders.filter((o) => o.class === "active").length : 0;
  const explored = !!(plan as { explored?: boolean } | null)?.explored;
  const swaps = (plan as { swaps?: string[] } | null)?.swaps ?? [];
  const reason = plan
    ? `${plan.orders.length} ordens, ${act} ativas${explored ? " (explorado)" : ""}`
    : "sem plano";
  console.log(`[CX-Exec] decision_request de ${msg.executorId ?? "?"} (${msg.league ?? "?"}) -> ${reason}`);
  safeSend(ws, { type: "decision_response", id: msg.id, plan });

  // Persiste a decisão VIVA (RPC) pra análise posterior (monitor da VPS lê cx_decision_log). Nota (2):
  // este bloco é do decision_request (plano+exploração); o sanitize_request F1/F2/F3 é o handler abaixo.
  // Best-effort: já respondemos o executor; a gravação não pode atrasar/derrubar o RPC.
  cxDecisionsTotal.inc({ action: "decision_request", mode: "live" });
  try {
    await prisma.cxDecisionLog.create({
      data: {
        executorId: msg.executorId ?? null,
        source: "rule",
        item: null,
        league: msg.league ?? null,
        action: "decision_request",
        reason,
        snapshot: {
          mode: "live",
          explored,
          swaps,
          active: act,
          total: plan?.orders.length ?? 0,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error(`[CX-Exec] insert decision_request falhou (${msg.executorId}):`, err);
  }
}

// ============================================================
// Sanitização F1/F2/F3 (RPC) — a VPS é a AUTORIDADE da decisão; o executor só EXECUTA.
// O executor manda o board (executor_state) + thresholds; a VPS aplica as regras usando
// dados FRESCOS (cx_signal p/ preço do sell_now + piso de margem) e devolve as `actions`.
// Persiste cada uma em cx_decision_log (mode=vps). Os guardrails/kill-switch são do executor.
// ============================================================

interface SanitizeAction {
  // reprice_sell = venda parada -> repreça p/ mercado (>= custo+margem); review = não dá com margem
  // -> executor cancela + standby + revisão pro usuário.
  action: "reprice" | "cancel_realloc" | "sell_now" | "reprice_sell" | "review";
  item: string;
  side?: string;
  orderKey?: string;   // cancel/reprice/reprice_sell/review: identidade estável da ordem-alvo
  base?: string;       // sell_now / reprice_sell
  ratio?: number;      // preço (base/item)
  qty?: number;
  reason: string;
}

async function handleSanitizeRequest(
  ws: WebSocket,
  msg: Extract<ExecutorMessage, { type: "sanitize_request" }>
): Promise<void> {
  // KILL SWITCH da VPS: CX_SANITIZE_KILL=1 -> devolve ZERO ações (para toda execução F1/F2/F3
  // sem depender da fila de comando/param local). Emergência: setar no .env.ws + restart.
  if (process.env.CX_SANITIZE_KILL === "1") {
    console.log(`[CX-Exec] sanitize_request de ${msg.executorId ?? "?"} — KILL SWITCH ativo, 0 ações`);
    safeSend(ws, { type: "sanitize_response", id: msg.id, actions: [] });
    return;
  }
  const league = msg.league;
  const state = msg.state ?? {};
  const th = msg.thresholds ?? {};
  const stockIdle = num(th.stock_idle_min) ?? 30;
  const staleMin = num(th.stale_min) ?? 45;
  const deadMin = num(th.dead_min) ?? 240;
  const minMargin = num(th.min_margin_pct) ?? 8;
  const sellStale = num(th.sell_stale_min) ?? 60;        // idade p/ sanitizar VENDA parada
  const sellMargin = num(th.sell_min_margin_pct) ?? 10;  // margem mínima sobre o custo p/ repreçar venda
  const strat = th.strategy ?? {};
  const actions: SanitizeAction[] = [];

  // custo/base por item (do ledger no executor_state) — pro piso de margem da venda
  const costByItem = new Map<string, number>();
  const baseByItem = new Map<string, string>();
  for (const p of state.positions ?? []) {
    if (!p.item) continue;
    costByItem.set(p.item, num(p.avgBuyRatio) ?? 0);
    if (p.base) baseByItem.set(p.item, p.base);
  }

  // --- F3: ordens stale (BUY: reprice/cancel; SELL parada: sanitização de venda separada) ---
  const staleSells: NonNullable<SanitizeState["orders"]> = [];
  for (const o of state.orders ?? []) {
    if (!o.item || !o.orderKey) continue;
    if ((strat[o.item] ?? "flip") === "mm") continue;   // mm: hold (sem ação)
    const age = num(o.ageMin) ?? 0;
    const fill = num(o.fillPct) ?? 0;
    if (o.side === "sell") {                             // VENDA -> sanitização própria (abaixo)
      if (age > sellStale && fill < 0.1) staleSells.push(o);
      continue;
    }
    if (o.undercut && age > staleMin && fill < 0.1) {
      actions.push({ action: "reprice", item: o.item, side: o.side, orderKey: o.orderKey,
        reason: `undercut, ${Math.floor(age)}min sem fill (${Math.round(fill * 100)}%)` });
    } else if (age > deadMin && fill <= 1e-9) {
      actions.push({ action: "cancel_realloc", item: o.item, side: o.side, orderKey: o.orderKey,
        reason: `sem fill há ${Math.floor(age)}min` });
    }
  }

  // --- F1: estoque parado sem venda aberta -> sell_now ---
  const stuck = (state.positions ?? []).filter(
    (p) => p.item && (num(p.net) ?? 0) >= 1 && !p.hasOpenSell && (num(p.idleMin) ?? 0) > stockIdle
  );

  // bids frescos p/ TODOS que precisam de preço (estoque parado + vendas paradas)
  let bidByItem = new Map<string, number>();
  const needBid = [...new Set([...stuck.map((p) => p.item as string),
    ...staleSells.map((o) => o.item as string)])];
  if (needBid.length && league) {
    try {
      const rows = await prisma.cxSignal.findMany({
        where: { league, item: { in: needBid } }, select: { item: true, bid: true },
      });
      bidByItem = new Map(rows.filter((r) => r.bid != null).map((r) => [r.item, Number(r.bid)]));
    } catch (err) {
      console.error("[CX-Exec] sanitize: cxSignal lookup falhou:", err);
    }
  }

  for (const p of stuck) {
    const bid = bidByItem.get(p.item as string);
    if (bid == null || bid <= 0) continue;               // sem preço fresco — NÃO vende às cegas
    const cost = num(p.avgBuyRatio) ?? 0;
    const floor = cost * (1 + minMargin / 100);
    if (cost > 0 && bid < floor) continue;               // abaixo do piso de margem — segura (F1)
    const qty = Math.floor(num(p.net) ?? 0);
    if (qty < 1) continue;
    actions.push({ action: "sell_now", item: p.item as string, side: "sell",
      base: p.base ?? "Chaos Orb", ratio: bid, qty,
      reason: `estoque ${qty}x parado ${Math.floor(num(p.idleMin) ?? 0)}min; bid ${bid} >= piso ${floor.toFixed(2)}` });
  }

  // --- SANITIZAÇÃO DE VENDA PARADA: repreça p/ vender (com margem) OU review+standby ---
  for (const o of staleSells) {
    const item = o.item as string;
    const bid = bidByItem.get(item);
    const age = Math.floor(num(o.ageMin) ?? 0);
    if (bid == null || bid <= 0) continue;               // sem preço — segura
    const cost = costByItem.get(item) ?? 0;
    const floor = cost > 0 ? cost * (1 + sellMargin / 100) : 0;
    if (cost > 0 && bid < floor) {
      // não dá pra vender com margem -> REVIEW (executor cancela + standby; usuário decide)
      actions.push({ action: "review", item, side: "sell", orderKey: o.orderKey,
        base: baseByItem.get(item) ?? "Chaos Orb", ratio: bid,
        reason: `venda ${age}min sem fill; mercado ${bid} < piso ${floor.toFixed(2)} (custo ${cost}) — revisar` });
    } else {
      // repreça pra vender no mercado (>= custo+margem quando o custo é conhecido)
      actions.push({ action: "reprice_sell", item, side: "sell", orderKey: o.orderKey,
        base: baseByItem.get(item) ?? "Chaos Orb", ratio: bid,
        reason: `venda ${age}min sem fill; repreça p/ mercado ${bid}${cost > 0 ? ` (custo ${cost}, +${sellMargin}%)` : " (custo desconhecido)"}` });
    }
  }

  // Persiste cada ação (auditoria + o monitor da VPS lê). mode=vps: DECIDIDA aqui.
  for (const a of actions) {
    cxDecisionsTotal.inc({ action: a.action, mode: "vps" });
    try {
      await prisma.cxDecisionLog.create({
        data: {
          executorId: msg.executorId ?? null, source: "rule", item: a.item, league: league ?? null,
          action: a.action, reason: a.reason,
          snapshot: { mode: "vps", side: a.side, ratio: a.ratio, qty: a.qty,
            orderKey: a.orderKey } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error("[CX-Exec] insert sanitize decision falhou:", err);
    }
  }

  console.log(`[CX-Exec] sanitize_request de ${msg.executorId ?? "?"} (${league ?? "?"}) -> `
    + `${actions.length} ações (${actions.map((a) => a.action).join(",") || "nenhuma"})`);
  safeSend(ws, { type: "sanitize_response", id: msg.id, actions });
}

// ============================================================
// Book relay — recebe o book capturado (sweep) e append no NDJSON que o
// ingest da VPS consome (-> snapshots -> publish -> plan). Fecha o loop.
// ============================================================

// Arquivo que o worker da VPS ingere (env CX_BOOK_NDJSON). Sem env = relay desligado.
const BOOK_NDJSON = process.env.CX_BOOK_NDJSON;
let bookLinesTotal = 0;

async function handleBookReport(msg: Extract<ExecutorMessage, { type: "book_report" }>): Promise<void> {
  if (!BOOK_NDJSON) return; // relay desligado (sem env configurado)
  const lines = Array.isArray(msg.lines) ? msg.lines : [];
  if (lines.length === 0) return;
  const chunk = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  try {
    await appendFile(BOOK_NDJSON, chunk, "utf8");
    bookLinesTotal += lines.length;
    if (bookLinesTotal % 500 < lines.length) {
      console.log(`[CX-Exec] book_report: +${lines.length} linhas (total ${bookLinesTotal}) -> ${BOOK_NDJSON}`);
    }
  } catch (err) {
    console.error("[CX-Exec] book_report append falhou:", err);
  }
}

// ============================================================
// Aplicação do fill_report ao cx_fills
// ============================================================

const num = (v: unknown): number | null => (v == null ? null : Number(v));

interface ApplyResult {
  ok: boolean;
  fillId?: string;
  reason?: string;
}

/**
 * Casa o report com um fill existente e preenche a perna; se não achar, cria
 * um fill source=plugin. Perna compra -> holding; perna venda -> closed + PnL.
 */
async function applyFillReport(d: FillReportData): Promise<ApplyResult> {
  if (!d?.item || !d?.league || (d.side !== "buy" && d.side !== "sell")) {
    return { ok: false, reason: "payload incompleto (item/league/side)" };
  }
  const base = d.base ?? "Chaos Orb";
  const filledAt = d.filledAt ? new Date(d.filledAt) : new Date();
  const ratio = d.ratio ?? null;
  const qty = d.qty ?? null;

  if (d.side === "buy") {
    // fill "open" mais recente do item aguardando a compra encher
    const open = await prisma.fill.findFirst({
      where: { item: d.item, league: d.league, buyFilledAt: null, status: "open" },
      orderBy: { buyPostedAt: "desc" },
    });

    const legsBuy = (f: { sellRatio?: unknown; sellQty?: unknown; sellFilledAt?: Date | null }): FillLegs => ({
      base,
      buyRatio: ratio,
      buyQty: qty,
      buyFilledAt: filledAt,
      sellRatio: num(f.sellRatio),
      sellQty: num(f.sellQty),
      sellFilledAt: f.sellFilledAt ?? null,
    });

    if (open) {
      const legs = legsBuy(open);
      const updated = await prisma.fill.update({
        where: { id: open.id },
        data: {
          base,
          buyRatio: ratio ?? open.buyRatio,
          buyQty: qty ?? open.buyQty,
          buyFilledAt: filledAt,
          buyQAhead: d.qAhead ?? open.buyQAhead,
          source: "plugin",
          status: deriveStatus(legs),
        },
      });
      console.log(`[CX-Exec] compra casada: ${d.item} -> fill ${updated.id} (${updated.status})`);
      return { ok: true, fillId: updated.id };
    }

    // sem fill aberto -> registra do zero (plugin observou uma compra não pré-registrada)
    const legs = legsBuy({});
    const created = await prisma.fill.create({
      data: {
        item: d.item,
        league: d.league,
        base,
        mode: "manual",
        source: "plugin",
        buyRatio: ratio,
        buyQty: qty,
        buyPostedAt: filledAt,
        buyFilledAt: filledAt,
        buyQAhead: d.qAhead ?? null,
        status: deriveStatus(legs),
      },
    });
    console.log(`[CX-Exec] compra nova (sem match): ${d.item} -> fill ${created.id}`);
    return { ok: true, fillId: created.id };
  }

  // side === "sell": casa com o fill "holding" (comprou, ainda não vendeu)
  const holding = await prisma.fill.findFirst({
    where: { item: d.item, league: d.league, buyFilledAt: { not: null }, sellFilledAt: null, status: "holding" },
    orderBy: { buyFilledAt: "desc" },
  });

  if (!holding) {
    console.warn(`[CX-Exec] venda órfã ignorada (sem holding): ${d.item} @ ${ratio}`);
    return { ok: false, reason: "sem posição holding p/ casar a venda" };
  }

  const legs: FillLegs = {
    base,
    buyRatio: num(holding.buyRatio),
    buyQty: num(holding.buyQty),
    buyFilledAt: holding.buyFilledAt,
    sellRatio: ratio,
    sellQty: qty,
    sellFilledAt: filledAt,
  };
  const pnl = derivePnl(legs);
  const updated = await prisma.fill.update({
    where: { id: holding.id },
    data: {
      sellRatio: ratio ?? holding.sellRatio,
      sellQty: qty ?? holding.sellQty,
      sellFilledAt: filledAt,
      sellQAhead: d.qAhead ?? holding.sellQAhead,
      source: "plugin",
      status: deriveStatus(legs),
      pnlChaos: pnl.pnlChaos ?? holding.pnlChaos,
      pnlDiv: pnl.pnlDiv ?? holding.pnlDiv,
    },
  });
  console.log(`[CX-Exec] venda casada: ${d.item} -> fill ${updated.id} FECHADO (pnl=${pnl.pnlChaos ?? pnl.pnlDiv})`);
  return { ok: true, fillId: updated.id };
}
