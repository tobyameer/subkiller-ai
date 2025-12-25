import { Schema, model } from "mongoose";

const MerchantRuleSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
      index: true,
    },
    defaultKind: { type: String },
    defaultService: { type: String },
    defaultCategory: { type: String },
    confidenceBoost: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    verifiedCount: { type: Number, default: 0 },
    declinedCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index: one rule per user+domain
MerchantRuleSchema.index({ userId: 1, domain: 1 }, { unique: true });

export const MerchantRuleModel = model("MerchantRule", MerchantRuleSchema);

