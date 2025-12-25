import { Schema, model } from "mongoose";

const TransactionSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: false, index: true },
        service: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 },
        currency: { type: String, required: true, default: "USD" },
        billingCycle: {
            type: String,
            enum: ["monthly", "yearly", "weekly", "one_time", "unknown"],
            default: "unknown",
        },
        chargedAt: { type: Date, required: true },
        gmailMessageId: { type: String, required: false, index: true },
        gmailThreadId: { type: String, required: false },
        description: { type: String, required: false },
    },
    { timestamps: true },
);

TransactionSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true, sparse: true });

export const TransactionModel = model("Transaction", TransactionSchema);
