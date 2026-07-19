-- Tabelas de sync event-sourced: espelham o SQLite do plugin CurrencyExchange.
-- Populadas pelo executor via WS (sync_events). INSERT idempotente (ON CONFLICT DO NOTHING).

-- Contabilidade: cada collect gera um evento imutável.
CREATE TABLE "cx_ledger_event" (
    "tx_id"     TEXT NOT NULL,
    "ts"        TEXT NOT NULL,
    "league"    TEXT NOT NULL,
    "item"      TEXT NOT NULL,
    "base"      TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "qty"       DOUBLE PRECISION NOT NULL,
    "ratio"     DOUBLE PRECISION NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_ledger_event_pkey" PRIMARY KEY ("tx_id")
);

-- Profundidade do book capturada por scan_book.
CREATE TABLE "cx_book_depth" (
    "ts"        TEXT NOT NULL,
    "league"    TEXT NOT NULL,
    "item"      TEXT NOT NULL,
    "base"      TEXT NOT NULL,
    "side"      TEXT NOT NULL,
    "rung"      INTEGER NOT NULL,
    "give"      INTEGER NOT NULL,
    "get"       INTEGER NOT NULL,
    "listed"    INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_book_depth_pkey" PRIMARY KEY ("ts","item","base","side","rung")
);

-- Detecção de fills pelo FillWatcher (analytics de timing/velocidade).
CREATE TABLE "cx_fill_event" (
    "id"         TEXT NOT NULL,
    "ts"         TEXT NOT NULL,
    "kind"       TEXT NOT NULL,
    "order_key"  TEXT NOT NULL,
    "league"     TEXT NOT NULL,
    "item"       TEXT NOT NULL,
    "base"       TEXT NOT NULL,
    "side"       TEXT NOT NULL,
    "ratio"      DOUBLE PRECISION NOT NULL,
    "qty"        DOUBLE PRECISION NOT NULL,
    "orig_stack" INTEGER NOT NULL,
    "synced_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_fill_event_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "cx_ledger_event_league_item_kind_idx" ON "cx_ledger_event"("league", "item", "kind");
CREATE INDEX "cx_book_depth_league_item_base_side_idx" ON "cx_book_depth"("league", "item", "base", "side");
CREATE INDEX "cx_fill_event_league_ts_idx" ON "cx_fill_event"("league", "ts");
