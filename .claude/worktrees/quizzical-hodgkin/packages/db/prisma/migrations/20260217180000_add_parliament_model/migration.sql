-- Add Parliament model and multi-parliament support
-- This migration adds: Parliament table, PartyBranch table, and parliament_id FK to core models

-- Create ParliamentLevel enum
CREATE TYPE "ParliamentLevel" AS ENUM ('NATIONAL', 'MUNICIPAL', 'PROVINCIAL', 'EUROPEAN');

-- Create parliaments table
CREATE TABLE "parliaments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "level" "ParliamentLevel" NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'NL',
    "municipality" TEXT,
    "seats" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "data_source_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parliaments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "parliaments_slug_key" ON "parliaments"("slug");

-- Create party_branches table
CREATE TABLE "party_branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "national_party_id" UUID,
    "parliament_id" UUID NOT NULL,
    "local_name" TEXT,
    "seats" INTEGER,
    "is_coalition" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "party_branches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "party_branches_party_id_parliament_id_key" UNIQUE ("party_id", "parliament_id"),
    CONSTRAINT "party_branches_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "party_branches_national_party_id_fkey" FOREIGN KEY ("national_party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "party_branches_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add parliament_id, external_id, source_system to parties
ALTER TABLE "parties" ADD COLUMN "parliament_id" UUID;
ALTER TABLE "parties" ADD COLUMN "external_id" TEXT;
ALTER TABLE "parties" ADD COLUMN "source_system" TEXT;
ALTER TABLE "parties" ADD CONSTRAINT "parties_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add parliament_id, external_id, source_system to mps
ALTER TABLE "mps" ADD COLUMN "parliament_id" UUID;
ALTER TABLE "mps" ADD COLUMN "external_id" TEXT;
ALTER TABLE "mps" ADD COLUMN "source_system" TEXT;
ALTER TABLE "mps" ADD CONSTRAINT "mps_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add parliament_id, external_id, source_system to motions
ALTER TABLE "motions" ADD COLUMN "parliament_id" UUID;
ALTER TABLE "motions" ADD COLUMN "external_id" TEXT;
ALTER TABLE "motions" ADD COLUMN "source_system" TEXT;
ALTER TABLE "motions" ADD CONSTRAINT "motions_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add parliament_id to votes
ALTER TABLE "votes" ADD COLUMN "parliament_id" UUID;
ALTER TABLE "votes" ADD CONSTRAINT "votes_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add parliament_id to programs
ALTER TABLE "programs" ADD COLUMN "parliament_id" UUID;
ALTER TABLE "programs" ADD CONSTRAINT "programs_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add parliament_id to precomputed_scorecards
ALTER TABLE "precomputed_scorecards" ADD COLUMN "parliament_id" UUID;
ALTER TABLE "precomputed_scorecards" ADD CONSTRAINT "precomputed_scorecards_parliament_id_fkey" FOREIGN KEY ("parliament_id") REFERENCES "parliaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the Tweede Kamer parliament record
INSERT INTO "parliaments" ("id", "slug", "name", "short_name", "level", "country", "municipality", "seats", "active", "data_source_config")
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'tweede-kamer',
    'Tweede Kamer der Staten-Generaal',
    'Tweede Kamer',
    'NATIONAL',
    'NL',
    NULL,
    150,
    true,
    '{"type": "tweedekamer", "apiBaseUrl": "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0"}'
);

-- Backfill all existing data with the Tweede Kamer parliament_id
UPDATE "parties" SET "parliament_id" = 'a0000000-0000-0000-0000-000000000001', "source_system" = 'tweedekamer' WHERE "parliament_id" IS NULL;
UPDATE "mps" SET "parliament_id" = 'a0000000-0000-0000-0000-000000000001', "source_system" = 'tweedekamer' WHERE "parliament_id" IS NULL;
UPDATE "motions" SET "parliament_id" = 'a0000000-0000-0000-0000-000000000001', "source_system" = 'tweedekamer' WHERE "parliament_id" IS NULL;
UPDATE "votes" SET "parliament_id" = 'a0000000-0000-0000-0000-000000000001' WHERE "parliament_id" IS NULL;
UPDATE "programs" SET "parliament_id" = 'a0000000-0000-0000-0000-000000000001' WHERE "parliament_id" IS NULL;
UPDATE "precomputed_scorecards" SET "parliament_id" = 'a0000000-0000-0000-0000-000000000001' WHERE "parliament_id" IS NULL;

-- Seed municipal parliament records
INSERT INTO "parliaments" ("id", "slug", "name", "short_name", "level", "country", "municipality", "seats", "active", "data_source_config")
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'amsterdam', 'Gemeenteraad Amsterdam', 'Amsterdam', 'MUNICIPAL', 'NL', 'amsterdam', 45, true, '{"type": "notubiz", "orgId": 281}'),
    ('b0000000-0000-0000-0000-000000000002', 'rotterdam', 'Gemeenteraad Rotterdam', 'Rotterdam', 'MUNICIPAL', 'NL', 'rotterdam', 45, true, '{"type": "ibabs", "sitename": "rotterdamraad", "notubizOrgId": 726}'),
    ('b0000000-0000-0000-0000-000000000003', 'den-haag', 'Gemeenteraad Den Haag', 'Den Haag', 'MUNICIPAL', 'NL', 'den-haag', 45, true, '{"type": "notubiz", "orgId": 318}'),
    ('b0000000-0000-0000-0000-000000000004', 'utrecht', 'Gemeenteraad Utrecht', 'Utrecht', 'MUNICIPAL', 'NL', 'utrecht', 45, true, '{"type": "ibabs", "sitename": "Utrecht"}');
