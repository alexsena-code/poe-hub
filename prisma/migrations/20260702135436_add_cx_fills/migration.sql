-- CreateEnum
CREATE TYPE "FillMode" AS ENUM ('manual', 'semi', 'full');

-- CreateEnum
CREATE TYPE "FillSource" AS ENUM ('ui', 'plugin', 'auto');

-- CreateEnum
CREATE TYPE "FillStatus" AS ENUM ('open', 'holding', 'closed', 'cancelled');

-- CreateTable
CREATE TABLE "cx_fills" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'Chaos Orb',
    "mode" "FillMode" NOT NULL DEFAULT 'manual',
    "source" "FillSource" NOT NULL DEFAULT 'ui',
    "status" "FillStatus" NOT NULL DEFAULT 'open',
    "buy_ratio" DECIMAL(18,6),
    "buy_qty" DECIMAL(18,4),
    "buy_posted_at" TIMESTAMP(3),
    "buy_filled_at" TIMESTAMP(3),
    "buy_q_ahead" DECIMAL(18,2),
    "sell_ratio" DECIMAL(18,6),
    "sell_qty" DECIMAL(18,4),
    "sell_posted_at" TIMESTAMP(3),
    "sell_filled_at" TIMESTAMP(3),
    "sell_q_ahead" DECIMAL(18,2),
    "fair_at_entry" DECIMAL(18,6),
    "pnl_chaos" DECIMAL(18,4),
    "pnl_div" DECIMAL(18,6),
    "bot_instance_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_fills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cx_fills_league_idx" ON "cx_fills"("league");

-- CreateIndex
CREATE INDEX "cx_fills_item_idx" ON "cx_fills"("item");

-- CreateIndex
CREATE INDEX "cx_fills_status_idx" ON "cx_fills"("status");

-- CreateIndex
CREATE INDEX "cx_fills_buy_posted_at_idx" ON "cx_fills"("buy_posted_at");

-- CreateIndex
CREATE INDEX "cx_fills_bot_instance_id_idx" ON "cx_fills"("bot_instance_id");

-- AddForeignKey
ALTER TABLE "cx_fills" ADD CONSTRAINT "cx_fills_bot_instance_id_fkey" FOREIGN KEY ("bot_instance_id") REFERENCES "bot_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
