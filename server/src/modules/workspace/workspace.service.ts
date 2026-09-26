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
  DirectAddMemberInput,
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
      workspace.members.some((m) => (m.userId?._id?.toString() || m.userId?.toString()) === userId);

    if (!isMember) throw new ForbiddenError('Not a member of this workspace');
    return workspace;
  }

  static async getUserWorkspaces(userId: string): Promise<IWorkspace[]> {
    return Workspace.find({
      $or: [
        { ownerId: new mongoose.Types.ObjectId(userId) },
        { 'members.userId': new mongoose.Types.ObjectId(userId) },
      ],
    })
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar')
      .sort({ createdAt: -1 });
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
  ): Promise<{ message: string; inviteToken: string; inviteUrl: string }> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const inviter = await User.findById(inviterId);
    const existingUser = await User.findOne({ email: input.email.toLowerCase().trim() });

    if (existingUser) {
      const alreadyMember = workspace.members.some(
        (m) => (m.userId?._id?.toString() || m.userId?.toString()) === existingUser._id.toString(),
      );
      if (alreadyMember) throw new ConflictError('User is already a member of this workspace');
    }

    const inviteToken = uuidv4();
    const redis = getRedisClient();
    try {
      await redis.setex(
        `invite:${inviteToken}`,
        48 * 3600,
        JSON.stringify({
          workspaceId,
          email: input.email.toLowerCase().trim(),
          role: input.role,
          inviterId,
        }),
      );
    } catch {
      // Non-blocking
    }

    const inviteUrl = `${env.CLIENT_URL}/invite/accept?token=${inviteToken}`;
    await sendEmail({
      to: input.email,
      subject: `Invitation to join ${workspace.name}`,
      html: inviteEmailHtml(inviter?.name || 'A team member', workspace.name, inviteUrl),
    }).catch(() => {});

    await this.logActivity(workspaceId, inviterId, 'invited_member', 'member', undefined, {
      email: input.email,
      role: input.role,
      inviteToken,
    });

    return { message: 'Invitation link generated and email sent successfully', inviteToken, inviteUrl };
  }

  static async directAddMember(
    workspaceId: string,
    adderId: string,
    input: DirectAddMemberInput,
  ): Promise<{ workspace: IWorkspace; member: any }> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const cleanEmail = input.email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = new User({
        name: input.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: 'Password123!',
      });
      await user.save();
    }

    const alreadyMemberIndex = workspace.members.findIndex((m: any) => {
      const mId = m.userId?._id ? m.userId._id.toString() : m.userId?.toString ? m.userId.toString() : String(m.userId);
      return mId === user!._id.toString();
    });

    if (alreadyMemberIndex >= 0) {
      workspace.members[alreadyMemberIndex].role = input.role;
    } else {
      workspace.members.push({
        userId: user._id,
        role: input.role,
        joinedAt: new Date(),
      });
    }

    if (!user.defaultWorkspaceId) {
      user.defaultWorkspaceId = workspace._id;
      await user.save();
    }

    await workspace.save();

    await this.logActivity(workspaceId, adderId, 'added_member', 'member', user._id, {
      email: cleanEmail,
      role: input.role,
    });

    const populated = await Workspace.findById(workspaceId)
      .populate('members.userId', 'name email avatar')
      .populate('ownerId', 'name email avatar');

    return { workspace: populated as any, member: user };
  }

  static async acceptInvite(token: string, userId: string): Promise<IWorkspace> {
    const redis = getRedisClient();
    let inviteData: any = null;

    try {
      const inviteDataStr = await redis.get(`invite:${token}`);
      if (inviteDataStr) inviteData = JSON.parse(inviteDataStr);
    } catch {
      // Fallback
    }

    if (!inviteData) {
      // Check activity log for token fallback
      const log = await ActivityLog.findOne({ 'metadata.inviteToken': token }).lean();
      if (log && log.metadata) {
        inviteData = {
          workspaceId: log.workspaceId.toString(),
          role: log.metadata.role || 'member',
        };
      }
    }

    if (!inviteData) throw new AppError('Invalid or expired invitation token', 400);

    const workspace = await Workspace.findById(inviteData.workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const alreadyMember = workspace.members.some(
      (m: any) => (m.userId?._id?.toString() || m.userId?.toString()) === userId,
    );

    if (!alreadyMember) {
      workspace.members.push({
        userId: new mongoose.Types.ObjectId(userId),
        role: inviteData.role || 'member',
        joinedAt: new Date(),
      });
      await workspace.save();
    }

    await this.logActivity(
      workspace._id.toString(),
      userId,
      'joined_workspace',
      'member',
      new mongoose.Types.ObjectId(userId),
    );

    const populated = await Workspace.findById(workspace._id)
      .populate('members.userId', 'name email avatar')
      .populate('ownerId', 'name email avatar');

    return populated as any;
  }

  static async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    updaterId: string,
    input: UpdateMemberRoleInput,
  ): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const ownerIdStr = workspace.ownerId.toString();
    if (ownerIdStr === targetUserId) {
      throw new ForbiddenError('Cannot change the workspace owner role');
    }

    const member = workspace.members.find((m: any) => {
      const mId = m.userId?._id ? m.userId._id.toString() : m.userId?.toString ? m.userId.toString() : String(m.userId);
      return mId === String(targetUserId);
    });

    if (!member) throw new NotFoundError('Member not found in this workspace');

    member.role = input.role;
    await workspace.save();

    await this.logActivity(workspaceId, updaterId, 'updated_member_role', 'member', member.userId, {
      newRole: input.role,
    });

    const populated = await Workspace.findById(workspaceId)
      .populate('members.userId', 'name email avatar')
      .populate('ownerId', 'name email avatar');

    return populated as any;
  }

  static async removeMember(
    workspaceId: string,
    targetUserId: string,
    removerId: string,
  ): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    const ownerIdStr = workspace.ownerId.toString();
    if (ownerIdStr === targetUserId) {
      throw new ForbiddenError('Cannot remove the workspace owner');
    }

    workspace.members = workspace.members.filter((m: any) => {
      const mId = m.userId?._id ? m.userId._id.toString() : m.userId?.toString ? m.userId.toString() : String(m.userId);
      return mId !== String(targetUserId);
    });

    await workspace.save();

    await this.logActivity(workspaceId, removerId, 'removed_member', 'member', new mongoose.Types.ObjectId(targetUserId));

    const populated = await Workspace.findById(workspaceId)
      .populate('members.userId', 'name email avatar')
      .populate('ownerId', 'name email avatar');

    return populated as any;
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
