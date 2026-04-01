-- Add start_day_offset to simulations (which day of the league to start from)
ALTER TABLE "simulations" ADD COLUMN "start_day_offset" INTEGER NOT NULL DEFAULT 0;
