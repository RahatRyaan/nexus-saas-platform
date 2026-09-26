import mongoose from 'mongoose';
import { Conversation, IConversation } from './chat.model';
import { Message, IMessage } from './chat.model';
import { Workspace } from '../workspace/workspace.model';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { getIO } from '../../socket';
import { parsePagination, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';

export class ChatService {
  static async getOrCreateDirectConversation(
    workspaceId: string,
    user1Id: string,
    user2Id: string,
  ): Promise<IConversation> {
    const participants = [new mongoose.Types.ObjectId(user1Id), new mongoose.Types.ObjectId(user2Id)];

    let conv = await Conversation.findOne({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      type: 'direct',
      participants: { $all: participants, $size: 2 },
    }).populate('participants', 'name email avatar');

    if (!conv) {
      conv = new Conversation({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        type: 'direct',
        participants,
      });
      await conv.save();
      await conv.populate('participants', 'name email avatar');
    }

    return conv;
  }

  static async createGroupConversation(
    workspaceId: string,
    creatorId: string,
    name: string,
    participantIds: string[],
    type: 'group' | 'channel' = 'group',
  ): Promise<IConversation> {
    const allParticipantIds = Array.from(new Set([creatorId, ...participantIds])).map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const conv = new Conversation({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      type,
      name,
      participants: allParticipantIds,
    });
    await conv.save();
    return conv.populate('participants', 'name email avatar');
  }

  static async getUserConversations(
    workspaceId: string,
    userId: string,
  ): Promise<IConversation[]> {
    const wsObjId = new mongoose.Types.ObjectId(workspaceId);
    const userObjId = new mongoose.Types.ObjectId(userId);

    // Auto-create or join general workspace channel if it exists
    let generalChannel = await Conversation.findOne({
      workspaceId: wsObjId,
      type: 'channel',
      name: 'General Product Discussion',
    });

    if (!generalChannel) {
      // Find all workspace members to populate the initial general channel
      const ws = await Workspace.findById(wsObjId).lean();
      const allMemberIds = (ws as any)?.members?.map((m: any) => m.userId) || [userObjId];
      if ((ws as any)?.ownerId && !allMemberIds.some((id: any) => id.toString() === (ws as any).ownerId.toString())) {
        allMemberIds.push((ws as any).ownerId);
      }

      generalChannel = new Conversation({
        workspaceId: wsObjId,
        type: 'channel',
        name: 'General Product Discussion',
        participants: allMemberIds,
      });
      await generalChannel.save();
    } else if (!generalChannel.participants.some((p) => p.toString() === userId)) {
      // Auto-add member to the channel
      generalChannel.participants.push(userObjId);
      await generalChannel.save();
    }

    return Conversation.find({
      workspaceId: wsObjId,
      $or: [{ participants: userObjId }, { type: 'channel' }],
    })
      .populate('participants', 'name email avatar')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });
  }

  static async getMessages(
    conversationId: string,
    workspaceId: string,
    userId: string,
    query: { page?: string; limit?: string },
  ): Promise<PaginatedResult<IMessage>> {
    const conv = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!conv) throw new NotFoundError('Conversation not found');

    const { page, limit, skip } = parsePagination(query);

    const [messages, total] = await Promise.all([
      Message.find({ conversationId: conv._id })
        .populate('senderId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversationId: conv._id }),
    ]);

    return buildPaginatedResult(messages as any, total, page, limit);
  }

  static async sendMessage(
    conversationId: string,
    workspaceId: string,
    senderId: string,
    data: { content: string; attachments?: any[] },
  ): Promise<IMessage> {
    const conv = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    if (!conv) throw new NotFoundError('Conversation not found');

    // Auto-add sender to participants if not present
    if (!conv.participants.some((p) => p.toString() === senderId)) {
      conv.participants.push(new mongoose.Types.ObjectId(senderId));
    }

    const message = new Message({
      conversationId: conv._id,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      senderId: new mongoose.Types.ObjectId(senderId),
      content: data.content,
      attachments: data.attachments || [],
      readBy: [new mongoose.Types.ObjectId(senderId)],
    });
    await message.save();
    await message.populate('senderId', 'name email avatar');

    conv.lastMessage = message._id;
    conv.lastMessageAt = new Date();
    await conv.save();

    // Broadcast message to conversation room and to the entire workspace
    try {
      const io = getIO();
      io.to(`chat:${conversationId}`).emit('sendMessage', {
        message,
        conversationId,
      });
      io.to(`workspace:${workspaceId}`).emit('sendMessage', {
        message,
        conversationId,
      });
    } catch {
      // Socket not ready in tests
    }

    return message;
  }

  static async markAsRead(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await Message.updateMany(
      {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      { $addToSet: { readBy: new mongoose.Types.ObjectId(userId) } },
    );
  }

  static async deleteMessage(
    messageId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const message = await Message.findOne({
      _id: new mongoose.Types.ObjectId(messageId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      senderId: new mongoose.Types.ObjectId(userId),
    });
    if (!message) throw new NotFoundError('Message');
    await message.deleteOne();
  }

  static async getUserNotifications(
    userId: string,
    query: { page?: string; limit?: string },
  ) {
    const { page, limit, skip } = parsePagination(query);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
      Notification.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        isRead: false,
      }),
    ]);
    return { ...buildPaginatedResult(notifications as any, total, page, limit), unreadCount };
  }

  static async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(notificationId), userId: new mongoose.Types.ObjectId(userId) },
      { $set: { isRead: true } },
    );
  }

  static async markAllNotificationsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    );
  }
}
