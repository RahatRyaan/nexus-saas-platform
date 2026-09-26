import { Request, Response } from 'express';
import { KnowledgeService } from './knowledge.service';

export class KnowledgeController {
  static async upload(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'File is required' });
      return;
    }

    const doc = await KnowledgeService.uploadDocument(
      workspaceId!,
      req.user!.userId,
      file,
      req.body.title,
    );
    res.status(201).json({ doc });
  }

  static async list(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const documents = await KnowledgeService.listDocuments(workspaceId!);
    res.status(200).json({ documents });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const doc = await KnowledgeService.getDocument(req.params.id, workspaceId!);
    res.status(200).json({ doc });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    await KnowledgeService.deleteDocument(req.params.id, workspaceId!, req.user!.userId);
    res.status(200).json({ message: 'Document deleted successfully' });
  }

  static async search(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const query = req.query.q as string;
    const type = (req.query.type as 'semantic' | 'text') || 'semantic';
    const limit = parseInt(req.query.limit as string || '5', 10);

    if (!query) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }

    const results = await KnowledgeService.search(workspaceId!, query, type, limit);
    res.status(200).json({ results });
  }
}
