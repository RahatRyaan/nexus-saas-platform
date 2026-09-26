import { Request, Response } from 'express';
import { WorkspaceService } from './workspace.service';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from './workspace.schema';

export class WorkspaceController {
  static async create(req: Request, res: Response): Promise<void> {
    const input = createWorkspaceSchema.parse(req.body);
    const workspace = await WorkspaceService.create(req.user!.userId, input);
    res.status(201).json({ workspace });
  }

  static async list(req: Request, res: Response): Promise<void> {
    const workspaces = await WorkspaceService.getUserWorkspaces(req.user!.userId);
    res.status(200).json({ workspaces });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const workspace = await WorkspaceService.getById(req.params.id, req.user!.userId);
    res.status(200).json({ workspace });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const input = updateWorkspaceSchema.parse(req.body);
    const workspace = await WorkspaceService.update(req.params.id, req.user!.userId, input);
    res.status(200).json({ workspace });
  }

  static async invite(req: Request, res: Response): Promise<void> {
    const input = inviteMemberSchema.parse(req.body);
    const result = await WorkspaceService.inviteMember(req.params.id, req.user!.userId, input);
    res.status(200).json(result);
  }

  static async acceptInvite(req: Request, res: Response): Promise<void> {
    const { token } = req.body;
    const workspace = await WorkspaceService.acceptInvite(token, req.user!.userId);
    res.status(200).json({ workspace, message: 'Joined workspace successfully' });
  }

  static async updateMemberRole(req: Request, res: Response): Promise<void> {
    const input = updateMemberRoleSchema.parse(req.body);
    const workspace = await WorkspaceService.updateMemberRole(
      req.params.id,
      req.params.userId,
      req.user!.userId,
      input,
    );
    res.status(200).json({ workspace });
  }

  static async removeMember(req: Request, res: Response): Promise<void> {
    await WorkspaceService.removeMember(req.params.id, req.params.userId, req.user!.userId);
    res.status(200).json({ message: 'Member removed successfully' });
  }

  static async getActivity(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit as string || '20', 10));
    const result = await WorkspaceService.getActivity(req.params.id, page, limit);
    res.status(200).json(result);
  }
}
