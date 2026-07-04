/**
 * Currency Exchange — métricas Prometheus do ws-server.
 *
 * Expostas em GET /metrics (mesmo HTTP server do upgrade WS), protegidas
 * pelo MESMO CX_WS_TOKEN do canal /ws/executor.
 *
 * Dois grupos:
 *  1. Métricas PRÓPRIAS do hub (conexões WS, fila cx_job, latência de jobs,
 *     fills, decisões) — instrumentadas direto no ws-server/handler.
 *  2. Métricas dos EXECUTORES (mensagem {"type":"metrics"}) — re-expostas
 *     com labels extras {executor_id, league}. Counters remotos chegam
 *     ACUMULADOS e viram Gauge aqui (cumulative-gauge, sufixo _total
 *     preservado); rate()/increase() no PromQL funcionam igual.
 */

import {
  Registry,
  Gauge,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";
import { prisma } from "../../lib/prisma.js";
import {
  normalizeRemoteMetrics,
  MAX_SERIES_PER_EXECUTOR,
  type RemoteMetricsPayload,
} from "./cx-metrics-remote.js";

export const registry = new Registry();

// Métricas default do processo Node (cpu, heap, event loop) — úteis pra
// saúde do próprio ws-server.
collectDefaultMetrics({ register: registry });

// ============================================================
// Métricas próprias do hub
// ============================================================

/** Conexões WS abertas por path (/ws/agent, /ws/executor, /ws/dashboard). */
export const cxWsConnections = new Gauge({
  name: "cx_ws_connections",
  help: "Conexões WebSocket abertas no monitor, por path",
  labelNames: ["path"] as const,
  registers: [registry],
});

/** Executores CX online (presença em memória do handler). */
export const cxExecutorsOnline = new Gauge({
  name: "cx_executors_online",
  help: "Executores CX com presença online",
  registers: [registry],
});

/** Profundidade da fila cx_job por status (poll no Postgres a cada 15s). */
export const cxJobQueueDepth = new Gauge({
  name: "cx_job_queue_depth",
  help: "Jobs na fila cx_job por status",
  labelNames: ["status"] as const,
  registers: [registry],
});

/** Latência total do job (createdAt -> doneAt), observada no command_ack. */
export const cxJobLatencySeconds = new Histogram({
  name: "cx_job_latency_seconds",
  help: "Latência de jobs cx_job do createdAt ao done/failed",
  buckets: [1, 2, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

/** fill_report aceitos, por lado (buy/sell). */
export const cxFillReportsTotal = new Counter({
  name: "cx_fill_reports_total",
  help: "fill_reports recebidos dos executores, por lado",
  labelNames: ["side"] as const,
  registers: [registry],
});

/** Mensagens recebidas no canal /ws/executor, por tipo. */
export const cxWsMessagesTotal = new Counter({
  name: "cx_ws_messages_total",
  help: "Mensagens WS recebidas no canal do executor, por tipo",
  labelNames: ["type"] as const,
  registers: [registry],
});

/** Decisões registradas (mensagem "decision"), por ação e modo. */
export const cxDecisionsTotal = new Counter({
  name: "cx_decisions_total",
  help: "Decisões reportadas pelos executores, por ação e modo",
  labelNames: ["action", "mode"] as const,
  registers: [registry],
});

// ============================================================
// Ingestão de métricas remotas dos executores
// ============================================================

interface RemoteMetric {
  gauge: Gauge<string>;
  labelNames: string[];
}

// nome -> gauge dinâmico. O PRIMEIRO sample define o conjunto de labels do
// nome; samples posteriores são projetados nesse conjunto (faltantes = "").
const remoteMetrics = new Map<string, RemoteMetric>();

// séries conhecidas por executor (cap de MAX_SERIES_PER_EXECUTOR)
const remoteSeriesByExecutor = new Map<string, Set<string>>();

// executores que já geraram o warning de cap (1 warning, não spam)
const capWarned = new Set<string>();

function getRemoteMetric(name: string, labelNames: string[]): RemoteMetric {
  let entry = remoteMetrics.get(name);
  if (!entry) {
    entry = {
      gauge: new Gauge({
        name,
        help: `Métrica remota de executor CX (${name}); counters remotos são cumulative-gauge`,
        labelNames,
        registers: [registry],
      }),
      labelNames,
    };
    remoteMetrics.set(name, entry);
  }
  return entry;
}

/**
 * Aplica uma mensagem {"type":"metrics"} de um executor no registry.
 * Retorna o resumo da normalização (pra log/telemetria do caller).
 */
export function applyRemoteMetrics(
  executorId: string,
  league: string | null,
  payload: RemoteMetricsPayload
): { accepted: number; droppedInvalid: number; droppedOverCap: number } {
  let known = remoteSeriesByExecutor.get(executorId);
  if (!known) {
    known = new Set();
    remoteSeriesByExecutor.set(executorId, known);
  }

  const res = normalizeRemoteMetrics(payload, executorId, league, known);

  for (const sample of res.accepted) {
    const entry = getRemoteMetric(sample.name, Object.keys(sample.labels).sort());
    // projeta as labels no conjunto fixado na criação do gauge
    const labels: Record<string, string> = {};
    for (const ln of entry.labelNames) labels[ln] = sample.labels[ln] ?? "";
    entry.gauge.set(labels, sample.value);
  }

  if (res.droppedOverCap > 0 && !capWarned.has(executorId)) {
    capWarned.add(executorId);
    console.warn(
      `[CX-Metrics] executor ${executorId} estourou o cap de ${MAX_SERIES_PER_EXECUTOR} séries — excedente descartado`
    );
  }
  if (res.droppedInvalid > 0) {
    console.warn(
      `[CX-Metrics] executor ${executorId}: ${res.droppedInvalid} amostra(s) inválida(s) descartada(s)`
    );
  }

  return {
    accepted: res.accepted.length,
    droppedInvalid: res.droppedInvalid,
    droppedOverCap: res.droppedOverCap,
  };
}

// ============================================================
// Poller da fila cx_job (Postgres) -> cx_job_queue_depth
// ============================================================

const JOB_QUEUE_POLL_MS = 15_000;
const CX_JOB_STATUSES = ["pending", "sent", "acked", "done", "failed", "expired"];

let queuePollTimer: ReturnType<typeof setInterval> | null = null;

async function pollJobQueueDepth(): Promise<void> {
  try {
    const groups = await prisma.cxJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts = new Map(groups.map((g) => [g.status, g._count._all]));
    for (const status of CX_JOB_STATUSES) {
      cxJobQueueDepth.set({ status }, counts.get(status) ?? 0);
    }
    // status fora do enum esperado (defensivo) também aparecem
    for (const g of groups) {
      if (!CX_JOB_STATUSES.includes(g.status)) {
        cxJobQueueDepth.set({ status: g.status }, g._count._all);
      }
    }
  } catch (err) {
    console.error("[CX-Metrics] poll cx_job_queue_depth falhou:", err);
  }
}

/** Inicia o poll periódico da profundidade da fila cx_job (15s). */
export function startJobQueueDepthPoller(): void {
  if (queuePollTimer) return;
  void pollJobQueueDepth();
  queuePollTimer = setInterval(() => void pollJobQueueDepth(), JOB_QUEUE_POLL_MS);
  console.log(`[CX-Metrics] poll da fila cx_job ativo (${JOB_QUEUE_POLL_MS}ms)`);
}

/** Corpo do GET /metrics (formato de exposição Prometheus). */
export async function renderMetrics(): Promise<{ contentType: string; body: string }> {
  return { contentType: registry.contentType, body: await registry.metrics() };
}
