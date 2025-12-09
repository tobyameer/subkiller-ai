import { Request, Response, NextFunction } from "express";
import { AuthedRequest } from "../middleware/auth";
import { createCheckoutSession, getPortalUrl } from "../services/billingService";
import { UserModel } from "../models/User";

export async function createSession(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { plan } = req.body as { plan: "pro" | "premium" };
    const url = await createCheckoutSession(req.user!.id, plan);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function billingStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.user!.id).lean();
    res.json({ plan: user?.subscriptionPlan });
  } catch (err) {
    next(err);
  }
}

export async function billingPortal(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { customerId } = req.query as { customerId: string };
    const url = await getPortalUrl(customerId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}
