import { Request, Response } from 'express';
import { BoardService } from './board.service';
import {
  createBoardSchema,
  updateBoardSchema,
  createListSchema,
  updateListSchema,
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
  addCommentSchema,
} from './board.schema';

export class BoardController {
  static async listBoards(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const boards = await BoardService.getWorkspaceBoards(workspaceId!);
    res.status(200).json({ boards });
  }

  static async createBoard(req: Request, res: Response): Promise<void> {
    const input = createBoardSchema.parse(req.body);
    const board = await BoardService.createBoard(
      req.user!.userId,
      input.workspaceId,
      input,
    );
    res.status(201).json({ board });
  }

  static async getBoard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const result = await BoardService.getBoardWithDetails(req.params.id, workspaceId!);
    res.status(200).json(result);
  }

  static async updateBoard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = updateBoardSchema.parse(req.body);
    const board = await BoardService.updateBoard(
      req.params.id,
      workspaceId!,
      req.user!.userId,
      input,
    );
    res.status(200).json({ board });
  }

  static async deleteBoard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    await BoardService.deleteBoard(req.params.id, workspaceId!, req.user!.userId);
    res.status(200).json({ message: 'Board deleted successfully' });
  }

  static async createList(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = createListSchema.parse(req.body);
    const list = await BoardService.createList(
      req.params.boardId,
      workspaceId!,
      req.user!.userId,
      input.title,
      input.position,
    );
    res.status(201).json({ list });
  }

  static async updateList(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = updateListSchema.parse(req.body);
    const list = await BoardService.updateList(req.params.listId, workspaceId!, input);
    res.status(200).json({ list });
  }

  static async deleteList(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    await BoardService.deleteList(req.params.listId, workspaceId!);
    res.status(200).json({ message: 'List deleted successfully' });
  }

  static async createCard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = createCardSchema.parse(req.body);
    const card = await BoardService.createCard(
      req.params.boardId,
      req.params.listId,
      workspaceId!,
      req.user!.userId,
      input,
    );
    res.status(201).json({ card });
  }

  static async updateCard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = updateCardSchema.parse(req.body);
    const card = await BoardService.updateCard(
      req.params.cardId,
      workspaceId!,
      req.user!.userId,
      input,
    );
    res.status(200).json({ card });
  }

  static async deleteCard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    await BoardService.deleteCard(req.params.cardId, workspaceId!, req.user!.userId);
    res.status(200).json({ message: 'Card deleted successfully' });
  }

  static async moveCard(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = moveCardSchema.parse(req.body);
    const card = await BoardService.moveCard(
      req.params.cardId,
      workspaceId!,
      req.user!.userId,
      input,
    );
    res.status(200).json({ card });
  }

  static async addComment(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = addCommentSchema.parse(req.body);
    const card = await BoardService.addComment(
      req.params.cardId,
      workspaceId!,
      req.user!.userId,
      input.content,
    );
    res.status(200).json({ card });
  }

  static async uploadAttachment(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'File is required' });
      return;
    }
    const card = await BoardService.uploadAttachment(
      req.params.cardId,
      workspaceId!,
      req.user!.userId,
      file,
    );
    res.status(200).json({ card });
  }
}
