-- Enable pgvector extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns for semantic similarity search
ALTER TABLE "motions" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "program_passages" ADD COLUMN "embedding" vector(1536);

-- Create HNSW indexes for fast cosine similarity search
CREATE INDEX "motions_embedding_idx" ON "motions" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "program_passages_embedding_idx" ON "program_passages" USING hnsw ("embedding" vector_cosine_ops);
