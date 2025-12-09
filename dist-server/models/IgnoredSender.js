import { Schema, model } from "mongoose";
const IgnoredSenderSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const IgnoredSenderModel = model("IgnoredSender", IgnoredSenderSchema);
