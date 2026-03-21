-- CreateEnum
CREATE TYPE "UpdateCategory" AS ENUM ('NIEUWE_DATA', 'NIEUWE_ANALYSE', 'VERBETERING', 'BUGFIX');

-- CreateTable
CREATE TABLE "platform_updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "category" "UpdateCategory",
    "link_url" VARCHAR(512),
    "link_label" VARCHAR(255),
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_updates_published_at_idx" ON "platform_updates"("published_at" DESC);
