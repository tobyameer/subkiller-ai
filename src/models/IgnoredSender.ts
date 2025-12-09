import { Schema, model, Types } from "mongoose";

export interface IgnoredSender {
  user: Types.ObjectId;
  sender: string;
  createdAt: Date;
}

const IgnoredSenderSchema = new Schema<IgnoredSender>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const IgnoredSenderModel = model<IgnoredSender>("IgnoredSender", IgnoredSenderSchema);
