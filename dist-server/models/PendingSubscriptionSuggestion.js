import { Schema, model } from "mongoose";
const SuggestionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gmailMessageId: { type: String, required: true, unique: true, index: true },
    gmailThreadId: { type: String, required: false },
    subject: { type: String, required: true },
    from: { type: String, required: true },
    date: { type: Date, required: false }, // Email date
    service: { type: String, required: false, default: null },
    amount: { type: Number, required: false, default: 0 },
    currency: { type: String, required: false, default: "USD" },
    category: { type: String, required: false, default: "Other" },
    kind: { type: String, required: false, default: "other" },
    status: { type: String, enum: ["pending", "accepted", "ignored"], default: "pending" },
    confidence: { type: Number, required: false, default: 0.5, min: 0, max: 1 }, // AI confidence score (0-1)
    confidenceLevel: { type: Number, min: 1, max: 5, required: false }, // Review level (1-5)
    needsReview: { type: Boolean, default: false }, // Flag for borderline cases that need manual review
    decision: { type: String, enum: ["pending", "verified", "declined"], default: "pending" },
    decisionMeta: { type: Schema.Types.Mixed }, // Stores { decidedAt, editedFields?, alwaysIgnoreSender? }
    cleanedPreview: { type: String }, // First ~30 lines of cleaned email text
    aiExtracted: { type: Schema.Types.Mixed }, // Full AI extraction result
    lastSeenAt: { type: Date, default: Date.now }, // Track when this suggestion was last seen/updated
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index for efficient querying by user, decision, and confidence level
SuggestionSchema.index({ user: 1, decision: 1, confidenceLevel: -1 });

export const PendingSubscriptionSuggestionModel = model("PendingSubscriptionSuggestion", SuggestionSchema);
