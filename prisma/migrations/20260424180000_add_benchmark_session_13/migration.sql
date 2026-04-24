-- CreateEnum
CREATE TYPE "BenchmarkType" AS ENUM ('qa', 'ideation', 'content_generation');

-- CreateTable
CREATE TABLE "benchmark_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BenchmarkType" NOT NULL,
    "payload" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_runs" (
    "id" TEXT NOT NULL,
    "type" "BenchmarkType" NOT NULL,
    "preset_id" TEXT,
    "model_overrides" JSONB NOT NULL,
    "request_body" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "total_cost_usd" DOUBLE PRECISION NOT NULL,
    "total_duration_ms" INTEGER NOT NULL,
    "llm_call_count" INTEGER NOT NULL,
    "qdrant_query_count" INTEGER NOT NULL,
    "http_status" INTEGER NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_evaluations" (
    "id" TEXT NOT NULL,
    "run_a_id" TEXT NOT NULL,
    "run_b_id" TEXT NOT NULL,
    "judge_model" TEXT NOT NULL,
    "verdict" JSONB NOT NULL,
    "winner" TEXT,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "benchmark_presets_type_idx" ON "benchmark_presets"("type");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_presets_name_type_key" ON "benchmark_presets"("name", "type");

-- CreateIndex
CREATE INDEX "benchmark_runs_type_idx" ON "benchmark_runs"("type");

-- CreateIndex
CREATE INDEX "benchmark_runs_created_at_idx" ON "benchmark_runs"("created_at");

-- CreateIndex
CREATE INDEX "benchmark_runs_preset_id_idx" ON "benchmark_runs"("preset_id");

-- CreateIndex
CREATE INDEX "benchmark_evaluations_run_a_id_idx" ON "benchmark_evaluations"("run_a_id");

-- CreateIndex
CREATE INDEX "benchmark_evaluations_run_b_id_idx" ON "benchmark_evaluations"("run_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_evaluations_run_a_id_run_b_id_judge_model_key" ON "benchmark_evaluations"("run_a_id", "run_b_id", "judge_model");

-- AddForeignKey
ALTER TABLE "benchmark_runs" ADD CONSTRAINT "benchmark_runs_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "benchmark_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_evaluations" ADD CONSTRAINT "benchmark_evaluations_run_a_id_fkey" FOREIGN KEY ("run_a_id") REFERENCES "benchmark_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_evaluations" ADD CONSTRAINT "benchmark_evaluations_run_b_id_fkey" FOREIGN KEY ("run_b_id") REFERENCES "benchmark_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
