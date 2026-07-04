/**
 * Currency Exchange — validação/normalização de métricas REMOTAS.
 *
 * O executor (Python) manda mensagens {"type":"metrics", counters:[...],
 * gauges:[...]} pelo /ws/executor. Este módulo é PURO (sem prom-client, sem
 * prisma) pra ser testável em isolamento: valida nome, sanitiza labels,
 * injeta {executor_id, league} e aplica o cap de séries por executor.
 *
 * Counters remotos chegam como valores ACUMULADOS do processo do executor;
 * o lado prom os representa como Gauge (set) mantendo o sufixo _total —
 * "cumulative gauge". rate()/increase() no PromQL funcionam igual.
 */

/** Nomes de métrica aceitos (prom-safe, minúsculo). */
export const METRIC_NAME_RE = /^[a-z_][a-z0-9_]*$/;

/** Nomes de label aceitos (prom-safe). */
export const LABEL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Cap de séries distintas (nome+labels) por executor. */
export const MAX_SERIES_PER_EXECUTOR = 100;

export interface RawRemoteSample {
  name?: unknown;
  labels?: unknown;
  value?: unknown;
}

export interface RemoteMetricsPayload {
  counters?: RawRemoteSample[] | unknown;
  gauges?: RawRemoteSample[] | unknown;
}

export interface NormalizedRemoteSample {
  name: string;
  /** labels do executor + {executor_id, league} injetados */
  labels: Record<string, string>;
  value: number;
  /** "counter" = acumulado remoto (vira cumulative-gauge no prom) */
  kind: "counter" | "gauge";
}

export interface NormalizeResult {
  accepted: NormalizedRemoteSample[];
  /** amostras descartadas por nome/label/valor inválido */
  droppedInvalid: number;
  /** amostras descartadas por estourar o cap de séries do executor */
  droppedOverCap: number;
}

/** Chave canônica de uma série: nome + labels ordenadas. */
export function seriesKey(name: string, labels: Record<string, string>): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}{${parts.join(",")}}`;
}

function sanitizeLabels(raw: unknown): Record<string, string> | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!LABEL_NAME_RE.test(k)) return null;
    // executor_id/league são NOSSOS — o executor não pode sobrescrever
    if (k === "executor_id" || k === "league") continue;
    if (v == null) continue;
    if (typeof v === "object") return null;
    out[k] = String(v);
  }
  return out;
}

function normalizeSample(
  raw: RawRemoteSample,
  kind: "counter" | "gauge",
  executorId: string,
  league: string | null
): NormalizedRemoteSample | null {
  if (raw == null || typeof raw !== "object") return null;
  const name = raw.name;
  if (typeof name !== "string" || !METRIC_NAME_RE.test(name)) return null;

  const value = typeof raw.value === "number" ? raw.value : Number(raw.value);
  if (raw.value == null || !Number.isFinite(value)) return null;

  const labels = sanitizeLabels(raw.labels);
  if (labels === null) return null;

  return {
    name,
    labels: { ...labels, executor_id: executorId, league: league ?? "" },
    value,
    kind,
  };
}

/**
 * Normaliza o payload de uma mensagem "metrics" de um executor.
 *
 * `knownSeries` é o conjunto de séries já vistas DESTE executor (mutado in
 * place): séries novas só entram enquanto o total ficar <= cap; amostras de
 * séries já conhecidas sempre passam (atualização não cria série).
 */
export function normalizeRemoteMetrics(
  payload: RemoteMetricsPayload,
  executorId: string,
  league: string | null,
  knownSeries: Set<string>,
  maxSeries: number = MAX_SERIES_PER_EXECUTOR
): NormalizeResult {
  const result: NormalizeResult = { accepted: [], droppedInvalid: 0, droppedOverCap: 0 };

  const groups: Array<[RawRemoteSample[] | unknown, "counter" | "gauge"]> = [
    [payload?.counters, "counter"],
    [payload?.gauges, "gauge"],
  ];

  for (const [list, kind] of groups) {
    if (list == null) continue;
    if (!Array.isArray(list)) {
      result.droppedInvalid++;
      continue;
    }
    for (const raw of list) {
      const sample = normalizeSample(raw as RawRemoteSample, kind, executorId, league);
      if (!sample) {
        result.droppedInvalid++;
        continue;
      }
      const key = seriesKey(sample.name, sample.labels);
      if (!knownSeries.has(key)) {
        if (knownSeries.size >= maxSeries) {
          result.droppedOverCap++;
          continue;
        }
        knownSeries.add(key);
      }
      result.accepted.push(sample);
    }
  }

  return result;
}
