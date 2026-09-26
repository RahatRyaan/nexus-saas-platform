import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  targetType: 'board' | 'card' | 'member' | 'workspace' | 'doc' | 'chat';
  targetId?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['board', 'card', 'member', 'workspace', 'doc', 'chat'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
);

activityLogSchema.index({ workspaceId: 1, timestamp: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
