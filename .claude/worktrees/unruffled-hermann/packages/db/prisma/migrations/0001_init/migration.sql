-- Initial schema for the Neutrale Transparantie-Platform

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgvector";

CREATE TYPE "VoteValue" AS ENUM ('FOR', 'AGAINST', 'ABSTAIN', 'ABSENT');
CREATE TYPE "EntityType" AS ENUM ('PARTY', 'MP');
CREATE TYPE "ConsultationStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ConsultationQuestionType" AS ENUM ('POLL', 'TEXT');
CREATE TYPE "UserRole" AS ENUM ('public', 'citizen', 'verified_mp', 'admin', 'auditor');
CREATE TYPE "MpVerifiedStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_DOC', 'DEBATE', 'PRESS', 'STATEMENT');

CREATE TABLE "parties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "abbreviation" text NOT NULL,
  "color_neutral" text,
  "website" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "mps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "parties" ("id"),
  "constituency" text,
  "start_date" timestamptz NOT NULL,
  "end_date" timestamptz,
  "verified_status" "MpVerifiedStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "motions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tk_id" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "text" text NOT NULL,
  "date_introduced" timestamptz NOT NULL,
  "status" text NOT NULL,
  "source_url" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "motion_sponsors" (
  "motion_id" uuid NOT NULL REFERENCES "motions" ("id"),
  "mp_id" uuid NOT NULL REFERENCES "mps" ("id"),
  "role" text NOT NULL,
  PRIMARY KEY ("motion_id", "mp_id")
);

CREATE TABLE "votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tk_id" text NOT NULL UNIQUE,
  "date" timestamptz NOT NULL,
  "title" text NOT NULL,
  "result" text NOT NULL,
  "source_url" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "vote_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vote_id" uuid NOT NULL REFERENCES "votes" ("id"),
  "mp_id" uuid NOT NULL REFERENCES "mps" ("id"),
  "vote_value" "VoteValue" NOT NULL,
  "party_id_snapshot" uuid NOT NULL REFERENCES "parties" ("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("vote_id", "mp_id")
);

CREATE TABLE "programs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "party_id" uuid NOT NULL REFERENCES "parties" ("id"),
  "election_year" integer NOT NULL,
  "source_url" text NOT NULL,
  "raw_text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "program_passages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" uuid NOT NULL REFERENCES "programs" ("id"),
  "chapter" text,
  "heading" text,
  "passage_text" text NOT NULL,
  "start_offset" integer NOT NULL,
  "end_offset" integer NOT NULL,
  "embedding" vector(1536),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" "EntityType" NOT NULL,
  "entity_id" text NOT NULL,
  "claim_text" text NOT NULL,
  "source_type" "SourceType" NOT NULL,
  "source_url" text NOT NULL,
  "source_date" timestamptz NOT NULL,
  "excerpt" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "consultations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_by_mp_id" uuid NOT NULL REFERENCES "mps" ("id"),
  "title" text NOT NULL,
  "draft_text" text NOT NULL,
  "explanation" text NOT NULL,
  "status" "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
  "opens_at" timestamptz,
  "closes_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "consultation_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultation_id" uuid NOT NULL REFERENCES "consultations" ("id"),
  "question_text" text NOT NULL,
  "type" "ConsultationQuestionType" NOT NULL,
  "options_json" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "hashed_password" text,
  "auth_provider" text NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'public',
  "verified_level" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "consultation_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultation_id" uuid NOT NULL REFERENCES "consultations" ("id"),
  "user_id" uuid REFERENCES "users" ("id"),
  "verified_level" text NOT NULL,
  "answers_json" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" uuid REFERENCES "users" ("id"),
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "before_json" jsonb,
  "after_json" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "algorithm_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "version" text NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "active" boolean NOT NULL DEFAULT false
);

CREATE TABLE "motion_program_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "motion_id" uuid NOT NULL REFERENCES "motions" ("id"),
  "party_id" uuid NOT NULL REFERENCES "parties" ("id"),
  "passage_id" uuid NOT NULL REFERENCES "program_passages" ("id"),
  "score" double precision NOT NULL,
  "rationale_json" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("motion_id", "party_id", "passage_id")
);

CREATE TABLE "raw_ingest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" text NOT NULL,
  "resource_type" text NOT NULL,
  "source_url" text,
  "payload" jsonb NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_motions_date" ON "motions" ("date_introduced");
CREATE INDEX "idx_votes_date" ON "votes" ("date");
CREATE INDEX "idx_vote_records_vote" ON "vote_records" ("vote_id");
CREATE INDEX "idx_vote_records_mp" ON "vote_records" ("mp_id");
CREATE INDEX "idx_program_passages_program" ON "program_passages" ("program_id");
