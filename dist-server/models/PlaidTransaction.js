import { Schema, model } from "mongoose";

const PlaidTransactionSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        transactionId: { type: String, required: true, index: true },
        merchantName: { type: String, required: false },
        merchantNormalized: { type: String, required: false, index: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },
        date: { type: Date, required: true, index: true },
        pending: { type: Boolean, default: false },
        accountId: { type: String, required: false },
        recurring: { type: Boolean, default: false },
        recurringCycle: {
            type: String,
            enum: ["monthly", "yearly", "weekly", "one_time", "unknown"],
            default: "unknown",
        },
    },
    { timestamps: true },
);

PlaidTransactionSchema.index({ userId: 1, transactionId: 1 }, { unique: true });
PlaidTransactionSchema.index({ userId: 1, merchantNormalized: 1, date: -1 });

export const PlaidTransactionModel = model("PlaidTransaction", PlaidTransactionSchema);
