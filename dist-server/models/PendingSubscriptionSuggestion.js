import { Schema, model } from "mongoose";
const SuggestionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gmailMessageId: { type: String, required: true },
    subject: { type: String, required: true },
    from: { type: String, required: true },
    service: { type: String, required: false, default: null },
    amount: { type: Number, required: false, default: 0 },
    currency: { type: String, required: false, default: "USD" },
    category: { type: String, required: false, default: "Other" },
    kind: { type: String, required: false, default: "other" },
    status: { type: String, enum: ["pending", "accepted", "ignored"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const PendingSubscriptionSuggestionModel = model("PendingSubscriptionSuggestion", SuggestionSchema);
