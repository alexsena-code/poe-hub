-- Revert proxy cost from daily back to monthly
-- Convert existing daily values back to monthly (*30)
UPDATE "global_cost_configs" SET "proxy_cost_per_bot_daily" = ROUND("proxy_cost_per_bot_daily" * 30, 2);

-- Rename column
ALTER TABLE "global_cost_configs" RENAME COLUMN "proxy_cost_per_bot_daily" TO "proxy_cost_per_bot_monthly";

-- Change precision from Decimal(10,4) to Decimal(10,2)
ALTER TABLE "global_cost_configs" ALTER COLUMN "proxy_cost_per_bot_monthly" TYPE DECIMAL(10,2);
