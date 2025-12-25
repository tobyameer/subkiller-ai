import { Schema, model } from "mongoose";

const SubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    service: { type: String, required: true, trim: true },

    serviceNormalized: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },

    category: { type: String, default: "Other" },
    amount: { type: Number, default: 0 },
    confirmedAmount: { type: Number },
    monthlyAmount: { type: Number, default: 0 },
    estimatedMonthlySpend: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    totalCharges: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "weekly", "one_time", "unknown"],
      default: "monthly",
    },
    confirmedBillingCycle: {
      type: String,
      enum: ["monthly", "yearly", "weekly", "one_time", "unknown"],
    },

    nextRenewal: { type: Date },
    lastChargeAt: { type: Date },
    firstDetectedAt: { type: Date, default: Date.now },

    source: {
      type: String,
      enum: ["email", "card", "email+card"],
      default: "email",
    },
    sourceConfidence: {
      type: String,
      enum: ["email+card", "email_only", "card_only", "unmatched"],
      default: "email_only",
    },

    plaidLinked: { type: Boolean, default: false },
    autoCanceled: { type: Boolean, default: false },
    autoCanceledReason: { type: String },
    lastPlaidTransactionId: { type: String },
    lastPlaidTransactionAt: { type: Date },

    deletedAt: { type: Date },

    status: {
      type: String,
      enum: [
        "active",
        "trial",
        "cancel_soon",
        "canceled",
        "paused",
        "payment_failed",
      ],
      default: "active",
    },
  },
  { timestamps: true }
);

SubscriptionSchema.pre("validate", function (next) {
  if (this.service) {
    this.serviceNormalized = this.service.trim().toLowerCase();
  }
  next();
});

SubscriptionSchema.index({ userId: 1, serviceNormalized: 1 }, { unique: true });

export const SubscriptionModel = model("Subscription", SubscriptionSchema);

/**
 * Backfill migration: Update all subscriptions missing serviceNormalized
 * Safe to run multiple times (idempotent)
 */
export async function backfillServiceNormalized() {
  try {
    const subs = await SubscriptionModel.find({
      $or: [
        { serviceNormalized: { $exists: false } },
        { serviceNormalized: null },
        { serviceNormalized: "" },
      ],
    }).lean();

    if (subs.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        "[migration] All subscriptions already have serviceNormalized"
      );
      return { updated: 0 };
    }

    // eslint-disable-next-line no-console
    console.log(
      `[migration] Found ${subs.length} subscriptions missing serviceNormalized, backfilling...`
    );

    let updated = 0;
    for (const sub of subs) {
      if (sub.service) {
        const normalized = (sub.service || "").trim().toLowerCase();
        await SubscriptionModel.updateOne(
          { _id: sub._id },
          { $set: { serviceNormalized: normalized } }
        );
        updated += 1;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[migration] Backfilled serviceNormalized for ${updated} subscriptions`
    );
    return { updated };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[migration] Error backfilling serviceNormalized:", err);
    throw err;
  }
}
