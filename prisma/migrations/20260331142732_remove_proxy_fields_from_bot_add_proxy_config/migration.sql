/*
  Warnings:

  - You are about to drop the column `proxy_password` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `proxy_port` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `proxy_username` on the `bots` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bots" DROP COLUMN "proxy_password",
DROP COLUMN "proxy_port",
DROP COLUMN "proxy_username";

-- CreateTable
CREATE TABLE "proxy_config" (
    "id" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8080,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_config_pkey" PRIMARY KEY ("id")
);
