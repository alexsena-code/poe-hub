-- Add cost snapshot fields to simulations
ALTER TABLE "simulations" ADD COLUMN "cost_config_name" TEXT;
ALTER TABLE "simulations" ADD COLUMN "sim_proxy_cost_per_bot_monthly" DECIMAL(10,2);
ALTER TABLE "simulations" ADD COLUMN "sim_leveling_cost_per_bot" DECIMAL(10,2);
ALTER TABLE "simulations" ADD COLUMN "sim_stash_pack_cost_per_bot" DECIMAL(10,2);
ALTER TABLE "simulations" ADD COLUMN "sim_explugins_key_cost_daily" DECIMAL(10,4);
ALTER TABLE "simulations" ADD COLUMN "sim_dpb_key_cost_daily" DECIMAL(10,4);

-- Copy existing linked cost config values into simulations
UPDATE "simulations" s SET
  "cost_config_name" = c."name",
  "sim_proxy_cost_per_bot_monthly" = c."proxy_cost_per_bot_monthly",
  "sim_leveling_cost_per_bot" = c."leveling_cost_per_bot",
  "sim_stash_pack_cost_per_bot" = c."stash_pack_cost_per_bot",
  "sim_explugins_key_cost_daily" = c."explugins_key_cost_daily",
  "sim_dpb_key_cost_daily" = c."dpb_key_cost_daily"
FROM "simulation_cost_links" l
JOIN "global_cost_configs" c ON c."id" = l."cost_config_id"
WHERE l."simulation_id" = s."id";
