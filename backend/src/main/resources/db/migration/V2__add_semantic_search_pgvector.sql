-- V2 Non-destructive migration for pgvector semantic search & full-text search

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE reels
    ADD COLUMN IF NOT EXISTS embedding vector(768),
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
    ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- HNSW index for fast cosine similarity search with pgvector
CREATE INDEX IF NOT EXISTS idx_reels_embedding_hnsw
    ON reels USING hnsw (embedding vector_cosine_ops);

-- GIN index for PostgreSQL full-text search across caption, transcript, summary, and author_name
CREATE INDEX IF NOT EXISTS idx_reels_fts_gin
    ON reels USING gin (
        to_tsvector(
            'english',
            COALESCE(caption, '') || ' ' ||
            COALESCE(transcript, '') || ' ' ||
            COALESCE(summary, '') || ' ' ||
            COALESCE(author_name, '')
        )
    );
