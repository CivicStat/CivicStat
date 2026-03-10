-- Drop unique index on votes.motion_id (allow multiple votes per motion)
DROP INDEX IF EXISTS "votes_motion_id_key";
