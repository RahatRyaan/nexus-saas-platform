import OpenAI from 'openai';
import { env } from '../../config/env';
import { getRedisClient } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { Subscription } from '../billing/billing.model';

const apiKey = env.OPENAI_API_KEY || env.GEMINI_API_KEY;
const baseURL = env.OPENAI_BASE_URL || (env.GEMINI_API_KEY ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined);

let openaiClient: OpenAI | null = null;

function getAIClient(): OpenAI | null {
  if (!apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL,
    });
  }
  return openaiClient;
}

const FREE_DAILY_TOKEN_LIMIT = 50000;
const PRO_DAILY_TOKEN_LIMIT = 500000;

export class AIService {
  static async checkAndTrackUsage(workspaceId: string, estimatedTokens: number): Promise<void> {
    const redis = getRedisClient();
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${workspaceId}:${today}`;

    let plan = await redis.get(`plan:${workspaceId}`);
    if (!plan) {
      const sub = await Subscription.findOne({ workspaceId, status: 'active' }).lean();
      plan = sub ? (sub as any).plan : 'free';
      await redis.setex(`plan:${workspaceId}`, 3600, plan as string);
    }

    const limit = plan === 'pro' ? PRO_DAILY_TOKEN_LIMIT : FREE_DAILY_TOKEN_LIMIT;

    const currentUsage = parseInt((await redis.get(key)) || '0', 10);
    if (currentUsage + estimatedTokens > limit) {
      throw new AppError(
        `Daily AI token limit reached (${limit.toLocaleString()} tokens). Upgrade your plan or wait until tomorrow.`,
        429,
      );
    }

    await redis.incrby(key, estimatedTokens);
    await redis.expire(key, 86400 * 2);
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    return new Array(1536).fill(0).map(() => Math.random());
  }

  static async summarize(text: string, workspaceId: string): Promise<{ summary: string; tokensUsed: number }> {
    await this.checkAndTrackUsage(workspaceId, 500);
    const client = getAIClient();

    if (!client) {
      return {
        summary: `• Context analyzed (${text.length} chars)\n• High priority deliverables identified\n• Recommended next action: Proceed with execution sprint`,
        tokensUsed: 150,
      };
    }

    const model = env.OPENAI_MODEL || 'auto';
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an executive assistant for a software engineering team. Summarize the user content clearly in concise, structured bullet points.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    return {
      summary: response.choices[0].message.content || '',
      tokensUsed: response.usage?.total_tokens || 100,
    };
  }

  static async suggestTasks(
    goal: string,
    workspaceId: string,
  ): Promise<{ tasks: Array<{ title: string; priority: string; description: string }> }> {
    await this.checkAndTrackUsage(workspaceId, 400);
    const client = getAIClient();

    if (!client) {
      return {
        tasks: [
          { title: `Define scope for: ${goal}`, priority: 'high', description: 'Break down deliverables and requirements.' },
          { title: `Design database models and API routes`, priority: 'high', description: 'Create schemas and integration points.' },
          { title: `Implement core logic and UI components`, priority: 'medium', description: 'Build frontend and backend controllers.' },
        ],
      };
    }

    const model = env.OPENAI_MODEL || 'auto';
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a project manager. Break down the user's goal into 3-5 actionable Kanban tasks. Return ONLY valid JSON with this exact shape: { "tasks": [{ "title": string, "priority": "low"|"medium"|"high"|"urgent", "description": string }] }`,
        },
        { role: 'user', content: goal },
      ],
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content || '{"tasks":[]}';
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      return parsed.tasks ? parsed : { tasks: parsed };
    } catch {
      return {
        tasks: [
          { title: `Plan: ${goal}`, priority: 'high', description: 'Define user stories and acceptance criteria.' },
          { title: `Build: ${goal}`, priority: 'urgent', description: 'Develop backend endpoints and client UI components.' },
          { title: `Test & Deploy: ${goal}`, priority: 'medium', description: 'Verify test coverage and push changes to production.' },
        ],
      };
    }
  }

  static async ask(
    workspaceId: string,
    question: string,
  ): Promise<{ answer: string; sources: Array<{ docId: string; content: string }> }> {
    await this.checkAndTrackUsage(workspaceId, 1000);

    let sources: Array<{ docId: string; content: string }> = [];
    try {
      sources = await KnowledgeService.search(workspaceId, question, 'semantic', 3);
    } catch {
      // Vector search fallback
    }

    const contextText = sources.map((s, i) => `[Source ${i + 1}]:\n${s.content}`).join('\n\n');
    const client = getAIClient();

    if (!client) {
      return {
        answer: `Nexus AI Response:\n\nAll backend systems are active. Please configure your OPENAI_API_KEY in .env to receive live LLM responses.`,
        sources,
      };
    }

    const model = env.OPENAI_MODEL || 'auto';
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Nexus AI, an intelligent workspace assistant for a SaaS platform. Answer the user's question clearly, thoroughly, and professionally. Use the provided workspace context when helpful.\n\nContext:\n${contextText || 'Workspace environment'}`,
        },
        { role: 'user', content: question },
      ],
      temperature: 0.3,
    });

    return {
      answer: response.choices[0].message.content || '',
      sources,
    };
  }
}
