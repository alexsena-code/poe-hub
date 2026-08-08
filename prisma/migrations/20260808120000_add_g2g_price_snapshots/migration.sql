-- CreateTable
CREATE TABLE "g2g_price_snapshots" (
    "id" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item" TEXT NOT NULL DEFAULT 'Divine Orb',
    "league" TEXT NOT NULL,
    "g2g_league" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'PC',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "median" DECIMAL(18,8) NOT NULL,
    "mean" DECIMAL(18,8) NOT NULL,
    "min" DECIMAL(18,8) NOT NULL,
    "max" DECIMAL(18,8) NOT NULL,
    "p25" DECIMAL(18,8) NOT NULL,
    "p75" DECIMAL(18,8) NOT NULL,
    "offer_count" INTEGER NOT NULL,
    "raw_offer_count" INTEGER NOT NULL,
    "cheapest_sample" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g2g_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g2g_price_snapshots_collected_at_idx" ON "g2g_price_snapshots"("collected_at");

-- CreateIndex
CREATE INDEX "g2g_price_snapshots_item_league_collected_at_idx" ON "g2g_price_snapshots"("item", "league", "collected_at");
