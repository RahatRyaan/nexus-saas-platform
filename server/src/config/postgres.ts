import { Pool } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.POSTGRES_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Postgres pool error', { err });
    });
  }
  return pool;
}

export async function initPgVector(): Promise<void> {
  const client = await getPgPool().connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_id      VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        chunk_index INTEGER NOT NULL,
        content     TEXT NOT NULL,
        embedding   vector(1536),
        metadata    JSONB DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(doc_id, chunk_index)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_workspace
      ON document_embeddings (workspace_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
      ON document_embeddings USING hnsw (embedding vector_cosine_ops)
    `);
    logger.info('pgvector initialized');
  } catch (err) {
    logger.error('pgvector init error', { err });
    throw err;
  } finally {
    client.release();
  }
}

export async function disconnectPg(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Postgres disconnected');
  }
}
