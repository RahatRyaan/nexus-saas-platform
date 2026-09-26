import mongoose, { Document, Schema } from 'mongoose';

export interface IKnowledgeDoc extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  filename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  chunkCount: number;
  embeddingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  errorMessage?: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeDocSchema = new Schema<IKnowledgeDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    filename: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    embeddingStatus: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

knowledgeDocSchema.index({ workspaceId: 1, embeddingStatus: 1 });
knowledgeDocSchema.index({ workspaceId: 1, createdAt: -1 });

export const KnowledgeDoc = mongoose.model<IKnowledgeDoc>('KnowledgeDoc', knowledgeDocSchema);
