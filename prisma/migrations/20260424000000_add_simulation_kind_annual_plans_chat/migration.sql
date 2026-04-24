-- CreateEnum
CREATE TYPE "SimulationKind" AS ENUM ('operational', 'forecast');

-- AlterTable
ALTER TABLE "simulations" ADD COLUMN     "kind" "SimulationKind" NOT NULL DEFAULT 'operational',
ADD COLUMN     "sim_custom_costs" JSONB;

-- AlterTable
ALTER TABLE "simulation_weeks" ADD COLUMN     "build_cost_divines" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "global_cost_configs" ADD COLUMN     "custom_costs" JSONB;

-- CreateTable
CREATE TABLE "annual_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annual_custom_costs" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_plan_simulations" (
    "annual_plan_id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "annual_plan_simulations_pkey" PRIMARY KEY ("annual_plan_id","simulation_id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "layers" JSONB,
    "token_estimate" INTEGER,
    "latency_ms" INTEGER,
    "detected_page_type" TEXT,
    "cost" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "annual_plans_year_idx" ON "annual_plans"("year");

-- CreateIndex
CREATE INDEX "annual_plan_simulations_simulation_id_idx" ON "annual_plan_simulations"("simulation_id");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations"("user_id");

-- CreateIndex
CREATE INDEX "chat_conversations_updated_at_idx" ON "chat_conversations"("updated_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "simulations_kind_idx" ON "simulations"("kind");

-- AddForeignKey
ALTER TABLE "annual_plan_simulations" ADD CONSTRAINT "annual_plan_simulations_annual_plan_id_fkey" FOREIGN KEY ("annual_plan_id") REFERENCES "annual_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_plan_simulations" ADD CONSTRAINT "annual_plan_simulations_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
