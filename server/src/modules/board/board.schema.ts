import { z } from 'zod';

export const createBoardSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateBoardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const createListSchema = z.object({
  title: z.string().min(1).max(100),
  position: z.number().optional(),
});

export const updateListSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  position: z.number().optional(),
});

export const createCardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(10000).optional(),
  position: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const moveCardSchema = z.object({
  targetListId: z.string().min(1),
  previousCardId: z.string().nullable().optional(),
  nextCardId: z.string().nullable().optional(),
  version: z.number(),
});

export const addCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});
