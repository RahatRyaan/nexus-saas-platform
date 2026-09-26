import { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { createConversationSchema, sendMessageSchema } from './chat.schema';

export class ChatController {
  static async listConversations(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const conversations = await ChatService.getUserConversations(
      workspaceId!,
      req.user!.userId,
    );
    res.status(200).json({ conversations });
  }

  static async createConversation(req: Request, res: Response): Promise<void> {
    const input = createConversationSchema.parse(req.body);
    let conversation;

    if (input.type === 'direct' && input.participantIds.length === 1) {
      conversation = await ChatService.getOrCreateDirectConversation(
        input.workspaceId,
        req.user!.userId,
        input.participantIds[0],
      );
    } else {
      conversation = await ChatService.createGroupConversation(
        input.workspaceId,
        req.user!.userId,
        input.name || 'Group Chat',
        input.participantIds,
        input.type as 'group' | 'channel',
      );
    }

    res.status(201).json({ conversation });
  }

  static async getMessages(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const result = await ChatService.getMessages(
      req.params.id,
      workspaceId!,
      req.user!.userId,
      req.query,
    );
    res.status(200).json(result);
  }

  static async sendMessage(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = sendMessageSchema.parse(req.body);
    const message = await ChatService.sendMessage(
      req.params.id,
      workspaceId!,
      req.user!.userId,
      input,
    );
    res.status(201).json({ message });
  }

  static async markRead(req: Request, res: Response): Promise<void> {
    await ChatService.markAsRead(req.params.id, req.user!.userId);
    res.status(200).json({ message: 'Marked as read' });
  }

  static async deleteMessage(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    await ChatService.deleteMessage(req.params.messageId, workspaceId!, req.user!.userId);
    res.status(200).json({ message: 'Message deleted' });
  }

  static async getNotifications(req: Request, res: Response): Promise<void> {
    const result = await ChatService.getUserNotifications(req.user!.userId, req.query);
    res.status(200).json(result);
  }

  static async markNotificationRead(req: Request, res: Response): Promise<void> {
    await ChatService.markNotificationRead(req.params.id, req.user!.userId);
    res.status(200).json({ message: 'Notification marked as read' });
  }

  static async markAllNotificationsRead(req: Request, res: Response): Promise<void> {
    await ChatService.markAllNotificationsRead(req.user!.userId);
    res.status(200).json({ message: 'All notifications marked as read' });
  }
}
