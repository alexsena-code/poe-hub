-- CreateTable
CREATE TABLE "cx_signal" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'Chaos Orb',
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "spread_pct" DOUBLE PRECISION,
    "mm_buy" DOUBLE PRECISION,
    "mm_sell" DOUBLE PRECISION,
    "mm_spread_pct" DOUBLE PRECISION,
    "cap_div" DOUBLE PRECISION,
    "fair_vamp" DOUBLE PRECISION,
    "obi" DOUBLE PRECISION,
    "slip_pct" DOUBLE PRECISION,
    "half_life_h" DOUBLE PRECISION,
    "drift_day" DOUBLE PRECISION,
    "vol_pct" DOUBLE PRECISION,
    "kelly" DOUBLE PRECISION,
    "markout_pct" DOUBLE PRECISION,
    "liq_per_h" DOUBLE PRECISION,
    "p_fill_buy" DOUBLE PRECISION,
    "p_fill_sell" DOUBLE PRECISION,
    "p_roundtrip" DOUBLE PRECISION,
    "e_t_fill_h" DOUBLE PRECISION,
    "q_ahead_buy" DOUBLE PRECISION,
    "q_ahead_sell" DOUBLE PRECISION,
    "cxapi_lo" DOUBLE PRECISION,
    "cxapi_hi" DOUBLE PRECISION,
    "cxapi_ok" BOOLEAN,
    "conf" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_arb" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "price_chaos" DOUBLE PRECISION NOT NULL,
    "price_via_divine" DOUBLE PRECISION NOT NULL,
    "disc_pct" DOUBLE PRECISION NOT NULL,
    "grain_pct" DOUBLE PRECISION NOT NULL,
    "edge_pct" DOUBLE PRECISION NOT NULL,
    "vol_divine" DOUBLE PRECISION NOT NULL,
    "conf" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_arb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_market_hourly" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cx_market_hourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_book_level" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_book_level_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cx_signal_league_captured_at_idx" ON "cx_signal"("league", "captured_at");

-- CreateIndex
CREATE INDEX "cx_signal_item_idx" ON "cx_signal"("item");

-- CreateIndex
CREATE INDEX "cx_arb_league_captured_at_idx" ON "cx_arb"("league", "captured_at");

-- CreateIndex
CREATE INDEX "cx_market_hourly_league_item_ts_idx" ON "cx_market_hourly"("league", "item", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "cx_market_hourly_league_item_ts_key" ON "cx_market_hourly"("league", "item", "ts");

-- CreateIndex
CREATE INDEX "cx_book_level_league_item_captured_at_idx" ON "cx_book_level"("league", "item", "captured_at");
