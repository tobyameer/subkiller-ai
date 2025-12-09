import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription, } from "../services/subscriptionService";
export async function getSubscriptions(req, res, next) {
    try {
        const items = await listSubscriptions(req.user.id);
        res.json({ items });
    }
    catch (err) {
        next(err);
    }
}
export async function postSubscription(req, res, next) {
    try {
        const payload = req.body;
        const created = await createSubscription(req.user.id, {
            ...payload,
            nextRenewal: new Date(payload.nextRenewal),
            createdAt: new Date(),
        });
        res.status(201).json({ subscription: created });
    }
    catch (err) {
        next(err);
    }
}
export async function putSubscription(req, res, next) {
    try {
        const updated = await updateSubscription(req.params.id, req.user.id, req.body);
        res.json({ subscription: updated });
    }
    catch (err) {
        next(err);
    }
}
export async function removeSubscription(req, res, next) {
    try {
        await deleteSubscription(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
