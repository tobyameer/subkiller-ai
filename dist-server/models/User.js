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
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    proExpiresAt: { type: Date, required: false },
    gmailTokens: { type: GmailTokensSchema, required: false },
    gmailEmail: { type: String, required: false },
    gmailConnected: { type: Boolean, default: false },
    lastScanDate: { type: Date, required: false },
    scanUsage: {
        windowStart: { type: Date, required: false },
        count: { type: Number, default: 0 },
    },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    gender: { type: String, required: false },
    dob: { type: Date, required: false },
    country: { type: String, required: false },
    marketingOptIn: { type: Boolean, default: false },
    plaidAccessToken: { type: String, required: false },
    plaidItemId: { type: String, required: false },
    plaidCursor: { type: String, required: false },
    plaidLinked: { type: Boolean, default: false },
}, { timestamps: true });
export const UserModel = model("User", UserSchema);
