-- CreateEnum: ProgramType (idempotent)
DO $$ BEGIN
  CREATE TYPE "ProgramType" AS ENUM ('VERKIEZINGSPROGRAMMA', 'REGEERAKKOORD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add program_type column if not exists
DO $$ BEGIN
  ALTER TABLE "programs" ADD COLUMN "program_type" "ProgramType" NOT NULL DEFAULT 'VERKIEZINGSPROGRAMMA';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- AlterTable: Add coalition_party_ids column if not exists
DO $$ BEGIN
  ALTER TABLE "programs" ADD COLUMN "coalition_party_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Drop old unique constraint and create new one
ALTER TABLE "programs" DROP CONSTRAINT IF EXISTS "programs_party_id_election_year_key";
DROP INDEX IF EXISTS "programs_party_id_election_year_program_type_key";
CREATE UNIQUE INDEX "programs_party_id_election_year_program_type_key"
  ON "programs" ("party_id", "election_year", "program_type");
