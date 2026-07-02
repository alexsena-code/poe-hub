/**
 * Currency Exchange — Executor connection handler
 *
 * Endpoint: /ws/executor  (novo, ao lado de /ws/agent e /ws/dashboard)
 *
 * O cx-executor local (Python, espelha o agent.py) conecta aqui e reporta
 * fills detectados in-game pelo plugin. Modelo FINO da Fase 2:
 *   executor -> VPS:  register · heartbeat · fill_report · disconnect
 *   VPS -> executor:  (ainda não — caminho de comando fica pro semi/full-auto)
 *
 * Um fill_report casa com o fill "open"/"holding" criado pela UI ("Fazer Order")
 * e preenche a perna correspondente via prisma direto (server-side, sem auth REST).
 */

import { WebSocket } from "ws";
import { prisma } from "../../lib/prisma.js";
import { deriveStatus, derivePnl, type FillLegs } from "../../lib/fills.js";

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

type ExecutorMessage =
  | { type: "register"; executorId: string; pcName?: string; data?: { capabilities?: string[]; league?: string } }
  | { type: "heartbeat"; executorId: string }
  | { type: "fill_report"; executorId: string; pcName?: string; data: FillReportData }
  | { type: "disconnect"; executorId: string };

interface ExecutorInfo {
  executorId: string;
  pcName: string | null;
  lastSeen: string;
  isOnline: boolean;
  fillsApplied: number;
}

// Presença em memória (leve — não persiste bot_instances nesta fase).
const executors = new Map<string, ExecutorInfo>();

export function getExecutors(): ExecutorInfo[] {
  return Array.from(executors.values());
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

    executorId = msg.executorId;

    try {
      switch (msg.type) {
        case "register":
          handleRegister(msg);
          break;
        case "heartbeat":
          touch(msg.executorId);
          break;
        case "fill_report": {
          const res = await applyFillReport(msg.data);
          touch(msg.executorId);
          const inst = executors.get(msg.executorId);
          if (inst && res.ok) inst.fillsApplied++;
          // eco de confirmação pro executor (idempotência/log local)
          safeSend(ws, { type: "fill_ack", ok: res.ok, fillId: res.fillId, reason: res.reason });
          break;
        }
        case "disconnect":
          markOffline(msg.executorId);
          break;
        default:
          console.warn(`[CX-Exec] tipo desconhecido: ${(msg as { type: string }).type}`);
      }
    } catch (err) {
      console.error(`[CX-Exec] erro no tipo "${msg.type}":`, err);
    }
  });

  ws.on("close", () => {
    if (executorId) markOffline(executorId);
  });

  ws.on("error", (err) => {
    console.error("[CX-Exec WS] erro:", err.message);
  });
}

function handleRegister(msg: Extract<ExecutorMessage, { type: "register" }>): void {
  const now = new Date().toISOString();
  executors.set(msg.executorId, {
    executorId: msg.executorId,
    pcName: msg.pcName ?? null,
    lastSeen: now,
    isOnline: true,
    fillsApplied: executors.get(msg.executorId)?.fillsApplied ?? 0,
  });
  console.log(`[CX-Exec] registrado: ${msg.executorId} (${msg.pcName ?? "?"}) caps=${msg.data?.capabilities ?? []}`);
}

function touch(executorId: string): void {
  const inst = executors.get(executorId);
  if (inst) {
    inst.lastSeen = new Date().toISOString();
    inst.isOnline = true;
  }
}

function markOffline(executorId: string): void {
  const inst = executors.get(executorId);
  if (inst) {
    inst.isOnline = false;
    console.log(`[CX-Exec] offline: ${executorId}`);
  }
}

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
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
