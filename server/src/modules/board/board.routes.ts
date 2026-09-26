import { Router } from 'express';
import { BoardController } from './board.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { asyncHandler } from '../../utils/asyncHandler';
import { upload } from '../../utils/fileUpload';

export const boardRouter = Router();

boardRouter.use(authenticate);

// Boards
boardRouter.get('/', requireRole('member'), asyncHandler(BoardController.listBoards));
boardRouter.post('/', requireRole('member'), asyncHandler(BoardController.createBoard));
boardRouter.get('/:id', requireRole('member'), asyncHandler(BoardController.getBoard));
boardRouter.patch('/:id', requireRole('admin'), asyncHandler(BoardController.updateBoard));
boardRouter.delete('/:id', requireRole('admin'), asyncHandler(BoardController.deleteBoard));

// Lists
boardRouter.post('/:boardId/lists', requireRole('member'), asyncHandler(BoardController.createList));
boardRouter.patch('/:boardId/lists/:listId', requireRole('member'), asyncHandler(BoardController.updateList));
boardRouter.delete('/:boardId/lists/:listId', requireRole('admin'), asyncHandler(BoardController.deleteList));

// Cards
boardRouter.post('/:boardId/lists/:listId/cards', requireRole('member'), asyncHandler(BoardController.createCard));
boardRouter.patch('/:boardId/cards/:cardId', requireRole('member'), asyncHandler(BoardController.updateCard));
boardRouter.delete('/:boardId/cards/:cardId', requireRole('member'), asyncHandler(BoardController.deleteCard));
boardRouter.post('/:boardId/cards/:cardId/move', requireRole('member'), asyncHandler(BoardController.moveCard));
boardRouter.post('/:boardId/cards/:cardId/comments', requireRole('member'), asyncHandler(BoardController.addComment));
boardRouter.post(
  '/:boardId/cards/:cardId/attachments',
  requireRole('member'),
  upload.single('file'),
  asyncHandler(BoardController.uploadAttachment),
);
