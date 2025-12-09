import { createCheckoutSession, getPortalUrl } from "../services/billingService";
import { UserModel } from "../models/User";
export async function createSession(req, res, next) {
    try {
        const { plan } = req.body;
        const url = await createCheckoutSession(req.user.id, plan);
        res.json({ url });
    }
    catch (err) {
        next(err);
    }
}
export async function billingStatus(req, res, next) {
    try {
        const user = await UserModel.findById(req.user.id).lean();
        res.json({ plan: user?.subscriptionPlan });
    }
    catch (err) {
        next(err);
    }
}
export async function billingPortal(req, res, next) {
    try {
        const { customerId } = req.query;
        const url = await getPortalUrl(customerId);
        res.json({ url });
    }
    catch (err) {
        next(err);
    }
}
