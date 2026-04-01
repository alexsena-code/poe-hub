-- Refactor GlobalCostConfig: monthly → daily costs, rename fields

-- Add new columns with defaults first (so existing rows get values)
ALTER TABLE "global_cost_configs" ADD COLUMN "proxy_cost_per_bot_daily" DECIMAL(10,4) NOT NULL DEFAULT 0;
ALTER TABLE "global_cost_configs" ADD COLUMN "leveling_cost_per_bot" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "global_cost_configs" ADD COLUMN "explugins_key_cost_daily" DECIMAL(10,4) NOT NULL DEFAULT 0;
ALTER TABLE "global_cost_configs" ADD COLUMN "other_fixed_costs_daily" DECIMAL(10,4) NOT NULL DEFAULT 0;

-- Migrate existing data: convert monthly to daily (÷30)
UPDATE "global_cost_configs" SET
  "proxy_cost_per_bot_daily" = ROUND("proxy_cost_per_bot_monthly" / 30, 4),
  "leveling_cost_per_bot" = "vps_cost_monthly",
  "explugins_key_cost_daily" = ROUND("dpb_license_cost_monthly" / 30, 4),
  "other_fixed_costs_daily" = ROUND("other_fixed_costs_monthly" / 30, 4);

-- Drop old columns
ALTER TABLE "global_cost_configs" DROP COLUMN "proxy_cost_per_bot_monthly";
ALTER TABLE "global_cost_configs" DROP COLUMN "vps_cost_monthly";
ALTER TABLE "global_cost_configs" DROP COLUMN "dpb_license_cost_monthly";
ALTER TABLE "global_cost_configs" DROP COLUMN "other_fixed_costs_monthly";
ALTER TABLE "global_cost_configs" DROP COLUMN "other_variable_cost_per_bot";
