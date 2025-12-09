import { Schema, model } from "mongoose";

export type SubscriptionPlan = "free" | "pro" | "premium";

export interface GmailTokens {
  access: string;
  refresh: string;
  expiry: number;
}

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  subscriptionPlan: SubscriptionPlan;
  gmailTokens?: GmailTokens;
  lastScanDate?: Date | null;
}

const GmailTokensSchema = new Schema<GmailTokens>(
  {
    access: { type: String },
    refresh: { type: String },
    expiry: { type: Number },
  },
  { _id: false },
);

const UserSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    subscriptionPlan: { type: String, enum: ["free", "pro", "premium"], default: "free" },
    gmailTokens: { type: GmailTokensSchema, required: false },
    lastScanDate: { type: Date, required: false, default: null },
  },
  { timestamps: true },
);

export const UserModel = model<User>("User", UserSchema);
