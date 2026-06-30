/*
  Warnings:

  - You are about to drop the `benchmark_evaluations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `benchmark_presets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `benchmark_runs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "benchmark_evaluations" DROP CONSTRAINT "benchmark_evaluations_run_a_id_fkey";

-- DropForeignKey
ALTER TABLE "benchmark_evaluations" DROP CONSTRAINT "benchmark_evaluations_run_b_id_fkey";

-- DropForeignKey
ALTER TABLE "benchmark_runs" DROP CONSTRAINT "benchmark_runs_preset_id_fkey";

-- DropTable
DROP TABLE "benchmark_evaluations";

-- DropTable
DROP TABLE "benchmark_presets";

-- DropTable
DROP TABLE "benchmark_runs";

-- DropEnum
DROP TYPE "BenchmarkType";
