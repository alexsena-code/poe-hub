-- CreateTable
CREATE TABLE "daily_prices" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "item" TEXT NOT NULL,
    "league" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'brl',
    "median" DECIMAL(18,8) NOT NULL,
    "mean" DECIMAL(18,8) NOT NULL,
    "min" DECIMAL(18,8) NOT NULL,
    "max" DECIMAL(18,8) NOT NULL,
    "cnl_price" DECIMAL(18,8),
    "sell_count" INTEGER NOT NULL,
    "buy_count" INTEGER NOT NULL,
    "total_offers" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_prices_date_idx" ON "daily_prices"("date");
CREATE INDEX "daily_prices_item_idx" ON "daily_prices"("item");
CREATE INDEX "daily_prices_league_idx" ON "daily_prices"("league");
CREATE UNIQUE INDEX "daily_prices_date_item_league_currency_key" ON "daily_prices"("date", "item", "league", "currency");
