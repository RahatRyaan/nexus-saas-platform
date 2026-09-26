import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const chatRouter = Router();

chatRouter.use(authenticate);

// Conversations
chatRouter.get('/conversations', asyncHandler(ChatController.listConversations));
chatRouter.post('/conversations', asyncHandler(ChatController.createConversation));
chatRouter.get('/conversations/:id/messages', asyncHandler(ChatController.getMessages));
chatRouter.post('/conversations/:id/messages', asyncHandler(ChatController.sendMessage));
chatRouter.post('/conversations/:id/read', asyncHandler(ChatController.markRead));
chatRouter.delete('/messages/:messageId', asyncHandler(ChatController.deleteMessage));

// Notifications
chatRouter.get('/notifications', asyncHandler(ChatController.getNotifications));
chatRouter.patch('/notifications/:id/read', asyncHandler(ChatController.markNotificationRead));
chatRouter.post('/notifications/read-all', asyncHandler(ChatController.markAllNotificationsRead));
