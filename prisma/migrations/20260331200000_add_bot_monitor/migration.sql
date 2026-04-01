-- CreateEnum
CREATE TYPE "BotAlertType" AS ENUM ('error', 'loop', 'stuck', 'inactivity', 'hideout', 'keyword');

-- CreateEnum
CREATE TYPE "BotAlertSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "bot_instances" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT,
    "pc_name" TEXT NOT NULL,
    "config_name" TEXT NOT NULL,
    "character_name" TEXT,
    "league" TEXT,
    "current_area" TEXT,
    "bot_version" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "total_logs" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warn_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_alerts" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "type" "BotAlertType" NOT NULL,
    "severity" "BotAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_instances_pc_name_config_name_key" ON "bot_instances"("pc_name", "config_name");

-- CreateIndex
CREATE INDEX "bot_instances_bot_id_idx" ON "bot_instances"("bot_id");

-- CreateIndex
CREATE INDEX "bot_instances_is_online_idx" ON "bot_instances"("is_online");

-- CreateIndex
CREATE INDEX "bot_instances_pc_name_idx" ON "bot_instances"("pc_name");

-- CreateIndex
CREATE INDEX "bot_alerts_instance_id_idx" ON "bot_alerts"("instance_id");

-- CreateIndex
CREATE INDEX "bot_alerts_type_idx" ON "bot_alerts"("type");

-- CreateIndex
CREATE INDEX "bot_alerts_created_at_idx" ON "bot_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "bot_instances" ADD CONSTRAINT "bot_instances_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_alerts" ADD CONSTRAINT "bot_alerts_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "bot_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
