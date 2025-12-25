

import { createCheckoutSession, getPortalUrl } from "../services/billingService.js";
import { UserModel } from "../models/User.js";

export async function upgradeToPro(req, res, next) {
    try {
        await UserModel.findByIdAndUpdate(req.user.id, { plan: "pro", proExpiresAt: null });
        res.json({ ok: true, plan: "pro" });
    }
    catch (err) {
        next(err);
    }
}

export async function cancelPro(req, res, next) {
    try {
        await UserModel.findByIdAndUpdate(req.user.id, { plan: "free", proExpiresAt: null, plaidLinked: false, plaidAccessToken: null });
        res.json({ ok: true, plan: "free" });
    }
    catch (err) {
        next(err);
    }
}

export async function planStatus(req, res, next) {
    try {
        const user = await UserModel.findById(req.user.id).lean();
        res.json({ plan: user?.plan || "free", proExpiresAt: user?.proExpiresAt || null });
    }
    catch (err) {
        next(err);
    }
}

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
        res.json({ plan: user?.plan || "basic" });
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
