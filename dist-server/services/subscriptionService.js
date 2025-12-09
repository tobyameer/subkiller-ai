import { Types } from "mongoose";
import { SubscriptionModel } from "../models/Subscription";
export async function listSubscriptions(userId) {
    return SubscriptionModel.find({ userId }).sort({ createdAt: -1 }).lean();
}
export async function createSubscription(userId, payload) {
    return SubscriptionModel.create({ ...payload, userId: new Types.ObjectId(userId) });
}
export async function updateSubscription(id, userId, payload) {
    const updated = await SubscriptionModel.findOneAndUpdate({ _id: id, userId }, payload, { new: true });
    return updated;
}
export async function deleteSubscription(id, userId) {
    return SubscriptionModel.findOneAndDelete({ _id: id, userId });
}
