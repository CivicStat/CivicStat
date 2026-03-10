-- AlterTable: Add result column to motions (nullable, backfilled from votes)
ALTER TABLE "motions" ADD COLUMN "result" TEXT;

-- Backfill: Copy vote result to motion for all linked motions
UPDATE "motions" m
SET "result" = v."result"
FROM "votes" v
WHERE v."motion_id" = m."id"
  AND v."result" IS NOT NULL
  AND v."result" != '';
