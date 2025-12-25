import { Schema, model } from "mongoose";

const ChargeSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
        service: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 },
        currency: { type: String, default: "USD" },
        billingCycle: {
            type: String,
            enum: ["monthly", "yearly", "weekly", "one_time", "unknown"],
            default: "unknown",
        },
        chargedAt: { type: Date, required: true },
        gmailMessageId: { type: String, required: true, index: true },
        gmailThreadId: { type: String, required: false },
        subject: { type: String, required: false },
        from: { type: String, required: false },
        status: {
            type: String,
            enum: ["paid", "failed", "refunded"],
            default: "paid",
        },
    },
    { timestamps: true },
);

export const ChargeModel = model("Charge", ChargeSchema);
