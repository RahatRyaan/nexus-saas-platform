import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachment {
  _id: mongoose.Types.ObjectId;
  name: string;
  url: string;
  publicId?: string;
  size: number;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IComment {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICard extends Document {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  listId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  position: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignees: mongoose.Types.ObjectId[];
  labels: string[];
  dueDate?: Date;
  attachments: IAttachment[];
  comments: IComment[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IList extends Document {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBoard extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  color?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const commentSchema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const cardSchema = new Schema<ICard>(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    listId: { type: Schema.Types.ObjectId, ref: 'List', required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 10000 },
    position: { type: Number, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    labels: [{ type: String }],
    dueDate: { type: Date },
    attachments: [attachmentSchema],
    comments: [commentSchema],
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

cardSchema.index({ boardId: 1, listId: 1, position: 1 });
cardSchema.index({ workspaceId: 1, _id: 1 });

const listSchema = new Schema<IList>(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    position: { type: Number, required: true },
  },
  { timestamps: true },
);

listSchema.index({ boardId: 1, position: 1 });
listSchema.index({ workspaceId: 1, _id: 1 });

const boardSchema = new Schema<IBoard>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    color: { type: String, default: '#4F46E5' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

boardSchema.index({ workspaceId: 1, _id: 1 });

export const Board = mongoose.model<IBoard>('Board', boardSchema);
export const List = mongoose.model<IList>('List', listSchema);
export const Card = mongoose.model<ICard>('Card', cardSchema);
