import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeEventIds: string[]; // Idempotency tracking
  plan: 'free' | 'pro';
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },
    stripePriceId: {
      type: String,
    },
    stripeEventIds: [
      {
        type: String,
      },
    ],
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'trialing', 'incomplete'],
      default: 'active',
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

subscriptionSchema.index({ 'stripeEventIds': 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
