-- Make league non-nullable with default empty string
ALTER TABLE "daily_prices" ALTER COLUMN "league" SET DEFAULT '';
ALTER TABLE "daily_prices" ALTER COLUMN "league" SET NOT NULL;
UPDATE "daily_prices" SET "league" = '' WHERE "league" IS NULL;

-- Recreate the unique index without nulls
DROP INDEX IF EXISTS "daily_prices_date_item_league_currency_key";
CREATE UNIQUE INDEX "daily_prices_date_item_league_currency_key" ON "daily_prices"("date", "item", "league", "currency");
