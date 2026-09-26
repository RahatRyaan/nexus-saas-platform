import { Router } from 'express';
import { WorkspaceController } from './workspace.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { asyncHandler } from '../../utils/asyncHandler';

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);

workspaceRouter.post('/', asyncHandler(WorkspaceController.create));
workspaceRouter.get('/', asyncHandler(WorkspaceController.list));
workspaceRouter.post('/accept-invite', asyncHandler(WorkspaceController.acceptInvite));

workspaceRouter.get('/:id', requireRole('member'), asyncHandler(WorkspaceController.getById));
workspaceRouter.patch('/:id', requireRole('admin'), asyncHandler(WorkspaceController.update));
workspaceRouter.post('/:id/invite', requireRole('admin'), asyncHandler(WorkspaceController.invite));
workspaceRouter.post('/:id/members/direct-add', requireRole('admin'), asyncHandler(WorkspaceController.directAdd));
workspaceRouter.post('/:id/members', requireRole('admin'), asyncHandler(WorkspaceController.directAdd));

workspaceRouter.patch(
  '/:id/members/:userId/role',
  requireRole('admin'),
  asyncHandler(WorkspaceController.updateMemberRole),
);
workspaceRouter.post(
  '/:id/members/:userId/role',
  requireRole('admin'),
  asyncHandler(WorkspaceController.updateMemberRole),
);

workspaceRouter.delete(
  '/:id/members/:userId',
  requireRole('admin'),
  asyncHandler(WorkspaceController.removeMember),
);
workspaceRouter.post(
  '/:id/members/:userId/remove',
  requireRole('admin'),
  asyncHandler(WorkspaceController.removeMember),
);

workspaceRouter.get('/:id/activity', requireRole('member'), asyncHandler(WorkspaceController.getActivity));
