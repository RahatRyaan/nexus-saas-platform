import mongoose from 'mongoose';
import { KnowledgeDoc, IKnowledgeDoc } from './knowledge.model';
import { NotFoundError } from '../../middleware/errorHandler';
import { uploadToCloudinary } from '../../utils/fileUpload';
import { embeddingQueue } from '../../jobs/embedding.worker';
import { getPgPool } from '../../config/postgres';
import { AIService } from '../ai/ai.service';
import { WorkspaceService } from '../workspace/workspace.service';

export class KnowledgeService {
  static async uploadDocument(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    title?: string,
  ): Promise<IKnowledgeDoc> {
    const uploadResult = await uploadToCloudinary(
      file.buffer,
      file.mimetype,
      `workspaces/${workspaceId}/docs`,
      file.originalname,
    );

    const doc = new KnowledgeDoc({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      title: title || file.originalname,
      filename: file.originalname,
      fileUrl: uploadResult.url,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: new mongoose.Types.ObjectId(userId),
      embeddingStatus: 'pending',
    });
    await doc.save();

    // Enqueue background embedding job via BullMQ
    await embeddingQueue.add('embed-document', {
      docId: doc._id.toString(),
      workspaceId,
      fileBufferBase64: file.buffer.toString('base64'),
      mimeType: file.mimetype,
      title: doc.title,
    });

    await WorkspaceService.logActivity(workspaceId, userId, 'uploaded_doc', 'doc', doc._id, {
      title: doc.title,
    });

    return doc;
  }

  static async listDocuments(workspaceId: string): Promise<IKnowledgeDoc[]> {
    return KnowledgeDoc.find({ workspaceId: new mongoose.Types.ObjectId(workspaceId) })
      .populate('uploadedBy', 'name email avatar')
      .sort({ createdAt: -1 });
  }

  static async getDocument(docId: string, workspaceId: string): Promise<IKnowledgeDoc> {
    const doc = await KnowledgeDoc.findOne({
      _id: new mongoose.Types.ObjectId(docId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    }).populate('uploadedBy', 'name email avatar');

    if (!doc) throw new NotFoundError('Knowledge document');
    return doc;
  }

  static async deleteDocument(docId: string, workspaceId: string, userId: string): Promise<void> {
    const doc = await KnowledgeDoc.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(docId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!doc) throw new NotFoundError('Knowledge document');

    // Delete vector embeddings from pgvector
    try {
      const pool = getPgPool();
      await pool.query('DELETE FROM document_embeddings WHERE doc_id = $1', [docId]);
    } catch {
      // Postgres might not be running in tests
    }

    await WorkspaceService.logActivity(workspaceId, userId, 'deleted_doc', 'doc', doc._id);
  }

  static async search(
    workspaceId: string,
    query: string,
    type: 'semantic' | 'text' = 'semantic',
    limit = 5,
  ): Promise<Array<{ content: string; docId: string; score?: number; title?: string }>> {
    if (type === 'semantic') {
      return this.semanticSearch(workspaceId, query, limit);
    } else {
      return this.textSearch(workspaceId, query, limit);
    }
  }

  private static async semanticSearch(
    workspaceId: string,
    query: string,
    limit: number,
  ): Promise<Array<{ content: string; docId: string; score: number }>> {
    const queryEmbedding = await AIService.generateEmbedding(query);
    const pool = getPgPool();

    const result = await pool.query(
      `
      SELECT 
        doc_id,
        content,
        1 - (embedding <=> $1::vector) AS score
      FROM document_embeddings
      WHERE workspace_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
      [`[${queryEmbedding.join(',')}]`, workspaceId, limit],
    );

    return result.rows.map((r) => ({
      docId: r.doc_id,
      content: r.content,
      score: parseFloat(r.score),
    }));
  }

  private static async textSearch(
    workspaceId: string,
    query: string,
    limit: number,
  ): Promise<Array<{ content: string; docId: string }>> {
    const pool = getPgPool();
    const result = await pool.query(
      `
      SELECT doc_id, content
      FROM document_embeddings
      WHERE workspace_id = $1 AND content ILIKE $2
      LIMIT $3
    `,
      [workspaceId, `%${query}%`, limit],
    );

    return result.rows.map((r) => ({
      docId: r.doc_id,
      content: r.content,
    }));
  }
}
