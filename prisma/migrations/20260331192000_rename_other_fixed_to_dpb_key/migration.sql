-- Rename other_fixed_costs_daily to dpb_key_cost_daily
ALTER TABLE "global_cost_configs" RENAME COLUMN "other_fixed_costs_daily" TO "dpb_key_cost_daily";
