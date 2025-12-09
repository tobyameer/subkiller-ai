import { Schema, model } from "mongoose";
const SubscriptionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: String, required: true },
    category: { type: String, required: false, default: "Other" },
    amount: { type: Number, required: false, default: 0 },
    currency: { type: String, default: "USD" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    nextRenewal: { type: Date, required: true },
    status: {
        type: String,
        enum: ["active", "trial", "cancel_soon", "canceled", "paused"],
        default: "active",
    },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const SubscriptionModel = model("Subscription", SubscriptionSchema);
