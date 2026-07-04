-- CreateTable
CREATE TABLE "cx_executor" (
    "id" TEXT NOT NULL,
    "executor_id" TEXT NOT NULL,
    "pc_name" TEXT,
    "league" TEXT,
    "capabilities" JSONB,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_executor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_job" (
    "id" TEXT NOT NULL,
    "executor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requested_by" TEXT,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "acked_at" TIMESTAMP(3),
    "done_at" TIMESTAMP(3),

    CONSTRAINT "cx_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_params" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL DEFAULT '*',
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_params_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_log" (
    "id" TEXT NOT NULL,
    "executor_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_decision_log" (
    "id" TEXT NOT NULL,
    "executor_id" TEXT,
    "source" TEXT NOT NULL,
    "item" TEXT,
    "league" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB,
    "job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_decision_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cx_schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "executor_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cx_executor_executor_id_key" ON "cx_executor"("executor_id");

-- CreateIndex
CREATE INDEX "cx_executor_is_online_idx" ON "cx_executor"("is_online");

-- CreateIndex
CREATE INDEX "cx_job_status_executor_id_idx" ON "cx_job"("status", "executor_id");

-- CreateIndex
CREATE INDEX "cx_job_created_at_idx" ON "cx_job"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cx_params_scope_scope_key_key_key" ON "cx_params"("scope", "scope_key", "key");

-- CreateIndex
CREATE INDEX "cx_log_executor_id_ts_idx" ON "cx_log"("executor_id", "ts");

-- CreateIndex
CREATE INDEX "cx_decision_log_created_at_idx" ON "cx_decision_log"("created_at");

-- CreateIndex
CREATE INDEX "cx_decision_log_executor_id_idx" ON "cx_decision_log"("executor_id");

-- CreateIndex
CREATE INDEX "cx_schedule_enabled_idx" ON "cx_schedule"("enabled");
