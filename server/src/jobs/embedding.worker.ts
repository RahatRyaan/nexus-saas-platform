import { Queue, Worker, Job } from 'bullmq';
import { getBullMqRedisClient } from '../config/redis';
import { getPgPool } from '../config/postgres';
import { KnowledgeDoc } from '../modules/knowledge/knowledge.model';
import { AIService } from '../modules/ai/ai.service';
import { logger } from '../utils/logger';

const bullRedis = getBullMqRedisClient();

export const embeddingQueue = new Queue('embedding-queue', {
  connection: bullRedis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export interface EmbeddingJobData {
  docId: string;
  workspaceId: string;
  fileBufferBase64: string;
  mimeType: string;
  title: string;
}

function chunkText(text: string, maxChunkSize = 800, overlap = 100): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    currentChunk.push(word);
    currentLength += word.length + 1;

    if (currentLength >= maxChunkSize) {
      chunks.push(currentChunk.join(' '));
      const overlapWords = Math.floor(overlap / 6);
      currentChunk = currentChunk.slice(-overlapWords);
      currentLength = currentChunk.join(' ').length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.filter((c) => c.trim().length > 20);
}

export function initEmbeddingWorker(): Worker {
  const worker = new Worker<EmbeddingJobData>(
    'embedding-queue',
    async (job: Job<EmbeddingJobData>) => {
      const { docId, workspaceId, fileBufferBase64, title } = job.data;
      logger.info(`Starting embedding job for doc: ${docId}`);

      try {
        await KnowledgeDoc.findByIdAndUpdate(docId, { embeddingStatus: 'processing' });

        const rawText = Buffer.from(fileBufferBase64, 'base64').toString('utf-8');
        const textWithHeader = `${title}\n\n${rawText}`;
        const chunks = chunkText(textWithHeader);

        const pool = getPgPool();
        const client = await pool.connect();

        try {
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await AIService.generateEmbedding(chunk);

            await client.query(
              `
              INSERT INTO document_embeddings (doc_id, workspace_id, chunk_index, content, embedding)
              VALUES ($1, $2, $3, $4, $5::vector)
              ON CONFLICT (doc_id, chunk_index) DO UPDATE
                SET content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding
            `,
              [docId, workspaceId, i, chunk, `[${embedding.join(',')}]`],
            );
          }
        } finally {
          client.release();
        }

        await KnowledgeDoc.findByIdAndUpdate(docId, {
          embeddingStatus: 'ready',
          chunkCount: chunks.length,
        });

        logger.info(`Embedding complete for doc: ${docId} (${chunks.length} chunks)`);
      } catch (err: any) {
        logger.error(`Embedding job failed for doc: ${docId}`, { err });
        await KnowledgeDoc.findByIdAndUpdate(docId, {
          embeddingStatus: 'failed',
          errorMessage: err.message,
        });
        throw err;
      }
    },
    {
      connection: bullRedis as any,
      concurrency: 2,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed`, { err });
  });

  return worker;
}
