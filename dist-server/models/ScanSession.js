import { Schema, model } from "mongoose";

const ScanSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scanId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    progress: {
      totalMessages: { type: Number, default: 0 },
      processedMessages: { type: Number, default: 0 },
      foundCandidates: { type: Number, default: 0 },
      pendingReview: { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
      declined: { type: Number, default: 0 },
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

export const ScanSessionModel = model("ScanSession", ScanSessionSchema);

