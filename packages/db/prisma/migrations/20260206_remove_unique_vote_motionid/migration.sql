-- Remove unique constraint on votes.motion_id (multiple votes can link to one motion)
ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "votes_motion_id_key";
