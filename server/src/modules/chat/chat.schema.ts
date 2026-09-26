import { z } from 'zod';

export const createConversationSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(['direct', 'group', 'channel']).default('direct'),
  name: z.string().max(100).optional(),
  participantIds: z.array(z.string()).min(1),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        size: z.number(),
        mimeType: z.string(),
      }),
    )
    .optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
