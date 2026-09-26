import { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ForbiddenError, UnauthorizedError } from './errorHandler';
import { Workspace } from '../modules/workspace/workspace.model';
import { Board } from '../modules/board/board.model';

export type Role = 'owner' | 'admin' | 'member';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function requireRole(minRole: Role): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    let workspaceId =
      req.params.workspaceId ||
      req.query.workspaceId ||
      req.body.workspaceId ||
      req.user.workspaceId;

    // If param is boardId or :id on board routes, look up workspaceId
    if (!workspaceId && req.params.boardId && mongoose.isValidObjectId(req.params.boardId)) {
      const board = await Board.findById(req.params.boardId).select('workspaceId').lean();
      if (board) workspaceId = (board as any).workspaceId.toString();
    } else if (!workspaceId && req.params.id && mongoose.isValidObjectId(req.params.id)) {
      const ws = await Workspace.findById(req.params.id).select('_id').lean();
      if (ws) {
        workspaceId = ws._id.toString();
      } else {
        const board = await Board.findById(req.params.id).select('workspaceId').lean();
        if (board) workspaceId = (board as any).workspaceId.toString();
      }
    }

    if (!workspaceId) {
      return next(new ForbiddenError('Workspace context required'));
    }

    const workspace = await Workspace.findById(workspaceId).select('ownerId members').lean();
    if (!workspace) {
      return next(new ForbiddenError('Workspace not found or access denied'));
    }

    if (workspace.ownerId.toString() === req.user.userId) {
      return next();
    }

    const member = (workspace as any).members?.find(
      (m: any) => m.userId.toString() === req.user!.userId,
    );

    if (!member) {
      return next(new ForbiddenError('You are not a member of this workspace'));
    }

    const userRoleLevel = ROLE_HIERARCHY[member.role as Role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return next(new ForbiddenError(`Requires ${minRole} role or higher`));
    }

    next();
  };
}
