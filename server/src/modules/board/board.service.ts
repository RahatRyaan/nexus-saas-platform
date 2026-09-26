import mongoose from 'mongoose';
import { Board, List, Card, IBoard, IList, ICard } from './board.model';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { WorkspaceService } from '../workspace/workspace.service';
import { uploadToCloudinary } from '../../utils/fileUpload';
import { getIO } from '../../socket';

const INITIAL_POSITION_GAP = 16384;
const MIN_GAP_FOR_REBALANCE = 1;

export class BoardService {
  static async createBoard(
    userId: string,
    workspaceId: string,
    data: { title: string; description?: string; color?: string },
  ): Promise<IBoard> {
    const board = new Board({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      title: data.title,
      description: data.description,
      color: data.color || '#4F46E5',
      createdBy: new mongoose.Types.ObjectId(userId),
    });
    await board.save();

    const defaultLists = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultLists.length; i++) {
      await List.create({
        boardId: board._id,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        title: defaultLists[i],
        position: (i + 1) * INITIAL_POSITION_GAP,
      });
    }

    await WorkspaceService.logActivity(workspaceId, userId, 'created_board', 'board', board._id);
    return board;
  }

  static async getWorkspaceBoards(workspaceId: string): Promise<IBoard[]> {
    return Board.find({ workspaceId: new mongoose.Types.ObjectId(workspaceId) })
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 });
  }

  static async getBoardWithDetails(
    boardId: string,
    workspaceId: string,
  ): Promise<{ board: IBoard; lists: Array<IList & { cards: ICard[] }> }> {
    const board = await Board.findOne({
      _id: new mongoose.Types.ObjectId(boardId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    }).populate('createdBy', 'name email avatar');

    if (!board) throw new NotFoundError('Board');

    const lists = await List.find({ boardId: board._id }).sort({ position: 1 }).lean();
    const cards = await Card.find({ boardId: board._id })
      .populate('assignees', 'name email avatar')
      .populate('comments.userId', 'name email avatar')
      .sort({ position: 1 })
      .lean();

    const listsWithCards = lists.map((list) => ({
      ...list,
      cards: cards.filter((c) => c.listId.toString() === list._id.toString()),
    }));

    return { board, lists: listsWithCards as any };
  }

  static async updateBoard(
    boardId: string,
    workspaceId: string,
    userId: string,
    data: Partial<IBoard>,
  ): Promise<IBoard> {
    const board = await Board.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(boardId), workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      { $set: data },
      { new: true },
    );
    if (!board) throw new NotFoundError('Board');

    await WorkspaceService.logActivity(workspaceId, userId, 'updated_board', 'board', board._id);
    return board;
  }

  static async deleteBoard(boardId: string, workspaceId: string, userId: string): Promise<void> {
    const board = await Board.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(boardId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!board) throw new NotFoundError('Board');

    await List.deleteMany({ boardId: board._id });
    await Card.deleteMany({ boardId: board._id });

    await WorkspaceService.logActivity(workspaceId, userId, 'deleted_board', 'board', board._id);
  }

  static async createList(
    boardId: string,
    workspaceId: string,
    userId: string,
    title: string,
    customPosition?: number,
  ): Promise<IList> {
    let position = customPosition;
    if (position === undefined) {
      const lastList = await List.findOne({ boardId }).sort({ position: -1 });
      position = lastList ? lastList.position + INITIAL_POSITION_GAP : INITIAL_POSITION_GAP;
    }

    const list = new List({
      boardId: new mongoose.Types.ObjectId(boardId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      title,
      position,
    });
    await list.save();

    await WorkspaceService.logActivity(workspaceId, userId, 'created_list', 'board', list._id);
    return list;
  }

  static async updateList(
    listId: string,
    workspaceId: string,
    data: { title?: string; position?: number },
  ): Promise<IList> {
    const list = await List.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(listId), workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      { $set: data },
      { new: true },
    );
    if (!list) throw new NotFoundError('List');
    return list;
  }

  static async deleteList(listId: string, workspaceId: string): Promise<void> {
    const list = await List.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(listId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!list) throw new NotFoundError('List');
    await Card.deleteMany({ listId: list._id });
  }

  static async createCard(
    boardId: string,
    listId: string,
    workspaceId: string,
    userId: string,
    data: any,
  ): Promise<ICard> {
    let position = data.position;
    if (position === undefined) {
      const lastCard = await Card.findOne({ listId }).sort({ position: -1 });
      position = lastCard ? lastCard.position + INITIAL_POSITION_GAP : INITIAL_POSITION_GAP;
    }

    const card = new Card({
      boardId: new mongoose.Types.ObjectId(boardId),
      listId: new mongoose.Types.ObjectId(listId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      title: data.title,
      description: data.description,
      priority: data.priority || 'medium',
      position,
      assignees: data.assignees?.map((id: string) => new mongoose.Types.ObjectId(id)) || [],
      labels: data.labels || [],
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });
    await card.save();

    await WorkspaceService.logActivity(workspaceId, userId, 'created_card', 'card', card._id, {
      title: card.title,
    });
    return card;
  }

  static async updateCard(
    cardId: string,
    workspaceId: string,
    userId: string,
    data: any,
  ): Promise<ICard> {
    const updateData: any = { ...data, $inc: { version: 1 } };
    if (data.assignees) {
      updateData.assignees = data.assignees.map((id: string) => new mongoose.Types.ObjectId(id));
    }

    const card = await Card.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cardId), workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      updateData,
      { new: true },
    )
      .populate('assignees', 'name email avatar')
      .populate('comments.userId', 'name email avatar');

    if (!card) throw new NotFoundError('Card');

    await WorkspaceService.logActivity(workspaceId, userId, 'updated_card', 'card', card._id);
    return card;
  }

  static async deleteCard(cardId: string, workspaceId: string, userId: string): Promise<void> {
    const card = await Card.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(cardId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!card) throw new NotFoundError('Card');

    await WorkspaceService.logActivity(workspaceId, userId, 'deleted_card', 'card', card._id);
  }

  static async moveCard(
    cardId: string,
    workspaceId: string,
    userId: string,
    data: {
      targetListId: string;
      previousCardId?: string | null;
      nextCardId?: string | null;
      version: number;
    },
  ): Promise<ICard> {
    const card = await Card.findOne({
      _id: new mongoose.Types.ObjectId(cardId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!card) throw new NotFoundError('Card');

    if (card.version !== data.version) {
      throw new ConflictError('Card was modified concurrently. Please refresh.');
    }

    let newPosition: number;
    const targetListId = new mongoose.Types.ObjectId(data.targetListId);

    if (!data.previousCardId && !data.nextCardId) {
      newPosition = INITIAL_POSITION_GAP;
    } else if (!data.previousCardId && data.nextCardId) {
      const nextCard = await Card.findById(data.nextCardId);
      newPosition = nextCard ? nextCard.position / 2 : INITIAL_POSITION_GAP;
    } else if (data.previousCardId && !data.nextCardId) {
      const prevCard = await Card.findById(data.previousCardId);
      newPosition = prevCard ? prevCard.position + INITIAL_POSITION_GAP : INITIAL_POSITION_GAP;
    } else {
      const [prevCard, nextCard] = await Promise.all([
        Card.findById(data.previousCardId),
        Card.findById(data.nextCardId),
      ]);
      const prevPos = prevCard ? prevCard.position : 0;
      const nextPos = nextCard ? nextCard.position : INITIAL_POSITION_GAP * 2;
      const gap = nextPos - prevPos;

      if (gap < MIN_GAP_FOR_REBALANCE) {
        await this.rebalanceList(data.targetListId);
        return this.moveCard(cardId, workspaceId, userId, data);
      }

      newPosition = (prevPos + nextPos) / 2;
    }

    card.listId = targetListId;
    card.position = newPosition;
    card.version += 1;
    await card.save();

    try {
      const io = getIO();
      io.to(`board:${card.boardId}`).emit('cardMoved', {
        cardId: card._id.toString(),
        boardId: card.boardId.toString(),
        listId: card.listId.toString(),
        position: card.position,
        version: card.version,
        movedBy: userId,
      });
    } catch {
      // Socket not ready in tests
    }

    return card;
  }

  private static async rebalanceList(listId: string): Promise<void> {
    const cards = await Card.find({ listId }).sort({ position: 1 });
    for (let i = 0; i < cards.length; i++) {
      cards[i].position = (i + 1) * INITIAL_POSITION_GAP;
      await cards[i].save();
    }
  }

  static async addComment(
    cardId: string,
    workspaceId: string,
    userId: string,
    content: string,
  ): Promise<ICard> {
    const card = await Card.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cardId), workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      {
        $push: {
          comments: {
            userId: new mongoose.Types.ObjectId(userId),
            content,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).populate('comments.userId', 'name email avatar');

    if (!card) throw new NotFoundError('Card');
    return card;
  }

  static async uploadAttachment(
    cardId: string,
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<ICard> {
    const result = await uploadToCloudinary(
      file.buffer,
      file.mimetype,
      `workspaces/${workspaceId}/cards/${cardId}`,
      file.originalname,
    );

    const card = await Card.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cardId), workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      {
        $push: {
          attachments: {
            name: file.originalname,
            url: result.url,
            publicId: result.publicId,
            size: file.size,
            mimeType: file.mimetype,
            uploadedBy: new mongoose.Types.ObjectId(userId),
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    if (!card) throw new NotFoundError('Card');
    return card;
  }
}
