import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Workspace, IWorkspace } from './workspace.model';
import { ActivityLog } from './activity.model';
import { User } from '../auth/user.model';
import { getRedisClient } from '../../config/redis';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AppError,
} from '../../middleware/errorHandler';
import { sendEmail, inviteEmailHtml } from '../../utils/email';
import { env } from '../../config/env';
import {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from './workspace.schema';

export class WorkspaceService {
  static async create(userId: string, input: CreateWorkspaceInput): Promise<IWorkspace> {
    const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    const workspace = new Workspace({
      name: input.name,
      slug,
      ownerId: new mongoose.Types.ObjectId(userId),
      members: [{ userId: new mongoose.Types.ObjectId(userId), role: 'owner' }],
    });
    await workspace.save();

    await this.logActivity(workspace._id.toString(), userId, 'created_workspace', 'workspace', workspace._id);
    return workspace;
  }

  static async getById(workspaceId: string, userId: string): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.userId', 'name email avatar')
      .populate('ownerId', 'name email avatar');

    if (!workspace) throw new NotFoundError('Workspace');

    const isMember =
      workspace.ownerId._id.toString() === userId ||
      workspace.members.some((m) => m.userId._id.toString() === userId);

    if (!isMember) throw new ForbiddenError('Not a member of this workspace');
    return workspace;
  }

  static async getUserWorkspaces(userId: string): Promise<IWorkspace[]> {
    return Workspace.find({
      $or: [
        { ownerId: new mongoose.Types.ObjectId(userId) },
        { 'members.userId': new mongoose.Types.ObjectId(userId) },
      ],
    }).sort({ createdAt: -1 });
  }

  static async update(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceInput,
  ): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    if (input.name) workspace.name = input.name;
    if (input.avatar) workspace.avatar = input.avatar;
    await workspace.save();

    await this.logActivity(workspaceId, userId, 'updated_workspace', 'workspace', workspace._id);
    return workspace;
  }

  static async inviteMember(
    workspaceId: string,
    inviterId: string,
    input: InviteMemberInput,
  ): Promise<{ message: string; inviteToken: string }> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const inviter = await User.findById(inviterId);
    const existingUser = await User.findOne({ email: input.email });

    if (existingUser) {
      const alreadyMember = workspace.members.some(
        (m) => m.userId.toString() === existingUser._id.toString(),
      );
      if (alreadyMember) throw new ConflictError('User is already a member');
    }

    const inviteToken = uuidv4();
    const redis = getRedisClient();
    await redis.setex(
      `invite:${inviteToken}`,
      48 * 3600, // 48 hours
      JSON.stringify({
        workspaceId,
        email: input.email,
        role: input.role,
        inviterId,
      }),
    );

    const inviteUrl = `${env.CLIENT_URL}/invite/accept?token=${inviteToken}`;
    await sendEmail({
      to: input.email,
      subject: `Invitation to join ${workspace.name}`,
      html: inviteEmailHtml(inviter?.name || 'A team member', workspace.name, inviteUrl),
    }).catch(() => {
      // Don't fail the invite if email fails in dev
    });

    await this.logActivity(workspaceId, inviterId, 'invited_member', 'member', undefined, {
      email: input.email,
      role: input.role,
    });

    return { message: 'Invitation sent successfully', inviteToken };
  }

  static async acceptInvite(token: string, userId: string): Promise<IWorkspace> {
    const redis = getRedisClient();
    const inviteDataStr = await redis.get(`invite:${token}`);
    if (!inviteDataStr) throw new AppError('Invalid or expired invitation token', 400);

    const inviteData = JSON.parse(inviteDataStr);
    const workspace = await Workspace.findById(inviteData.workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const alreadyMember = workspace.members.some((m) => m.userId.toString() === userId);
    if (!alreadyMember) {
      workspace.members.push({
        userId: new mongoose.Types.ObjectId(userId),
        role: inviteData.role,
        joinedAt: new Date(),
      });
      await workspace.save();
    }

    await redis.del(`invite:${token}`);
    await this.logActivity(
      workspace._id.toString(),
      userId,
      'joined_workspace',
      'member',
      new mongoose.Types.ObjectId(userId),
    );

    return workspace;
  }

  static async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    updaterId: string,
    input: UpdateMemberRoleInput,
  ): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    if (workspace.ownerId.toString() === targetUserId) {
      throw new ForbiddenError('Cannot change owner role');
    }

    const member = workspace.members.find((m) => m.userId.toString() === targetUserId);
    if (!member) throw new NotFoundError('Member');

    member.role = input.role;
    await workspace.save();

    await this.logActivity(workspaceId, updaterId, 'updated_member_role', 'member', member.userId, {
      newRole: input.role,
    });
    return workspace;
  }

  static async removeMember(
    workspaceId: string,
    targetUserId: string,
    removerId: string,
  ): Promise<void> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    if (workspace.ownerId.toString() === targetUserId) {
      throw new ForbiddenError('Cannot remove workspace owner');
    }

    workspace.members = workspace.members.filter(
      (m) => m.userId.toString() !== targetUserId,
    );
    await workspace.save();

    await this.logActivity(workspaceId, removerId, 'removed_member', 'member', new mongoose.Types.ObjectId(targetUserId));
  }

  static async getActivity(
    workspaceId: string,
    page = 1,
    limit = 20,
  ): Promise<{ logs: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      ActivityLog.find({ workspaceId })
        .populate('userId', 'name email avatar')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments({ workspaceId }),
    ]);
    return { logs, total };
  }

  static async logActivity(
    workspaceId: string,
    userId: string,
    action: string,
    targetType: 'board' | 'card' | 'member' | 'workspace' | 'doc' | 'chat',
    targetId?: mongoose.Types.ObjectId,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await ActivityLog.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: new mongoose.Types.ObjectId(userId),
      action,
      targetType,
      targetId,
      metadata,
    }).catch(() => {});
  }
}
