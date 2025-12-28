import { Schema, model } from "mongoose";

const GmailTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    googleEmail: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    expiryDate: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export const GmailTokenModel = model("GmailToken", GmailTokenSchema);

