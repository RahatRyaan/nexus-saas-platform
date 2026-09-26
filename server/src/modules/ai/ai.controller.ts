import { Request, Response } from 'express';
import { AIService } from './ai.service';
import { z } from 'zod';

const summarizeSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty').max(50000),
});

const suggestTasksSchema = z.object({
  goal: z.string().min(1, 'Goal cannot be empty').max(2000),
});

const askSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(5000),
});

export class AIController {
  static async summarize(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = summarizeSchema.parse(req.body);
    const result = await AIService.summarize(input.text, workspaceId!);
    res.status(200).json(result);
  }

  static async suggestTasks(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = suggestTasksSchema.parse(req.body);
    const result = await AIService.suggestTasks(input.goal, workspaceId!);
    res.status(200).json(result);
  }

  static async ask(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const input = askSchema.parse(req.body);
    const result = await AIService.ask(workspaceId!, input.question);
    res.status(200).json(result);
  }
}
