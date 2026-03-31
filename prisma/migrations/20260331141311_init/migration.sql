-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('active', 'inactive', 'banned', 'maintenance');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('divine', 'chaos', 'usd', 'brl', 'other');

-- CreateEnum
CREATE TYPE "SaleUnit" AS ENUM ('divine', 'chaos', 'exalted', 'other');

-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('backlog', 'todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TaskModule" AS ENUM ('bots', 'prices', 'sales', 'simulations', 'infra', 'other');

-- CreateEnum
CREATE TYPE "PoeVersion" AS ENUM ('poe1', 'poe2');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'operator');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'operator',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bots" (
    "id" TEXT NOT NULL,
    "nick" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "proxy_ip" TEXT NOT NULL,
    "proxy_port" INTEGER,
    "proxy_username" TEXT NOT NULL,
    "proxy_password" TEXT NOT NULL,
    "proxy_eol" TIMESTAMP(3),
    "status" "BotStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_entries" (
    "id" TEXT NOT NULL,
    "discord_message_id" TEXT NOT NULL,
    "discord_channel_id" TEXT NOT NULL,
    "discord_server_id" TEXT NOT NULL,
    "author_discord_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "is_cnl" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(18,8) NOT NULL,
    "currency" "Currency" NOT NULL,
    "item" TEXT,
    "raw_message" TEXT NOT NULL,
    "message_timestamp" TIMESTAMP(3) NOT NULL,
    "league" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_sources" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "server_name" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cnl_author_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "unit" "SaleUnit" NOT NULL,
    "divine_price_usd" DECIMAL(18,8),
    "divine_price_brl" DECIMAL(18,8),
    "total_usd" DECIMAL(18,2),
    "total_brl" DECIMAL(18,2),
    "league" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_cnl" BOOLEAN NOT NULL DEFAULT false,
    "contact" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'draft',
    "duration_weeks" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_weeks" (
    "id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "label" TEXT,
    "default_active_bots" INTEGER NOT NULL,
    "default_divine_per_hour" DECIMAL(18,8) NOT NULL,
    "default_hours_per_day" DECIMAL(5,2) NOT NULL DEFAULT 24,
    "default_divine_price_usd" DECIMAL(18,8),
    "default_divine_price_brl" DECIMAL(18,8),

    CONSTRAINT "simulation_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_days" (
    "id" TEXT NOT NULL,
    "simulation_week_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE,
    "active_bots" INTEGER,
    "divine_per_hour" DECIMAL(18,8),
    "hours_per_day" DECIMAL(5,2),
    "divine_price_usd" DECIMAL(18,8),
    "divine_price_brl" DECIMAL(18,8),
    "override_notes" TEXT,

    CONSTRAINT "simulation_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_cost_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "proxy_cost_per_bot_monthly" DECIMAL(10,2) NOT NULL,
    "vps_cost_monthly" DECIMAL(10,2) NOT NULL,
    "dpb_license_cost_monthly" DECIMAL(10,2) NOT NULL,
    "other_fixed_costs_monthly" DECIMAL(10,2) NOT NULL,
    "other_variable_cost_per_bot" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_cost_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_cost_links" (
    "simulation_id" TEXT NOT NULL,
    "cost_config_id" TEXT NOT NULL,

    CONSTRAINT "simulation_cost_links_pkey" PRIMARY KEY ("simulation_id","cost_config_id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'backlog',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "assigned_to" TEXT,
    "created_by" TEXT NOT NULL,
    "due_date" DATE,
    "league" TEXT,
    "module" "TaskModule",
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "poe_version" "PoeVersion" NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "bots_status_idx" ON "bots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "price_entries_discord_message_id_key" ON "price_entries"("discord_message_id");

-- CreateIndex
CREATE INDEX "price_entries_discord_channel_id_idx" ON "price_entries"("discord_channel_id");

-- CreateIndex
CREATE INDEX "price_entries_message_timestamp_idx" ON "price_entries"("message_timestamp");

-- CreateIndex
CREATE INDEX "price_entries_currency_idx" ON "price_entries"("currency");

-- CreateIndex
CREATE INDEX "price_entries_is_cnl_idx" ON "price_entries"("is_cnl");

-- CreateIndex
CREATE INDEX "price_entries_league_idx" ON "price_entries"("league");

-- CreateIndex
CREATE UNIQUE INDEX "discord_sources_server_id_channel_id_key" ON "discord_sources"("server_id", "channel_id");

-- CreateIndex
CREATE INDEX "sales_buyer_id_idx" ON "sales"("buyer_id");

-- CreateIndex
CREATE INDEX "sales_date_idx" ON "sales"("date");

-- CreateIndex
CREATE INDEX "sales_league_idx" ON "sales"("league");

-- CreateIndex
CREATE INDEX "simulations_status_idx" ON "simulations"("status");

-- CreateIndex
CREATE INDEX "simulations_league_idx" ON "simulations"("league");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_weeks_simulation_id_week_number_key" ON "simulation_weeks"("simulation_id", "week_number");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_days_simulation_week_id_day_number_key" ON "simulation_days"("simulation_week_id", "day_number");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_idx" ON "tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_module_idx" ON "tasks"("module");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_name_key" ON "leagues"("name");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_weeks" ADD CONSTRAINT "simulation_weeks_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_days" ADD CONSTRAINT "simulation_days_simulation_week_id_fkey" FOREIGN KEY ("simulation_week_id") REFERENCES "simulation_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_cost_links" ADD CONSTRAINT "simulation_cost_links_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_cost_links" ADD CONSTRAINT "simulation_cost_links_cost_config_id_fkey" FOREIGN KEY ("cost_config_id") REFERENCES "global_cost_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
