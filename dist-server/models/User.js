import { Schema, model } from "mongoose";
const GmailTokensSchema = new Schema({
    access: { type: String },
    refresh: { type: String },
    expiry: { type: Number },
}, { _id: false });
const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    subscriptionPlan: { type: String, enum: ["free", "pro", "premium"], default: "free" },
    gmailTokens: { type: GmailTokensSchema, required: false },
}, { timestamps: true });
export const UserModel = model("User", UserSchema);
