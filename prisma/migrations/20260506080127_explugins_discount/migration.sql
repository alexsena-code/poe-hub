-- AlterTable
ALTER TABLE "global_cost_configs" ALTER COLUMN "proxy_cost_per_bot_monthly" DROP DEFAULT,
ALTER COLUMN "leveling_cost_per_bot" DROP DEFAULT,
ALTER COLUMN "explugins_key_cost_daily" DROP DEFAULT,
ALTER COLUMN "dpb_key_cost_daily" DROP DEFAULT;

-- AlterTable
ALTER TABLE "simulations" ADD COLUMN     "explugins_discount_percent" DECIMAL(5,2) DEFAULT 50,
ADD COLUMN     "explugins_discount_start_day" INTEGER;
