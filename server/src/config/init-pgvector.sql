CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS document_embeddings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id       VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(255) NOT NULL,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doc_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_workspace ON document_embeddings (workspace_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON document_embeddings USING hnsw (embedding vector_cosine_ops);
