-- AlterTable: Add keywords and sourceRef to promises
ALTER TABLE "promises" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "promises" ADD COLUMN "source_ref" TEXT;

-- AlterTable: Add review fields to promise_motion_matches
ALTER TABLE "promise_motion_matches" ADD COLUMN "reviewed_by" TEXT;
ALTER TABLE "promise_motion_matches" ADD COLUMN "reviewed_at" TIMESTAMP(3);
