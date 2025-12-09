import { NextFunction, Request, Response } from "express";
import { verifyAccess, verifyRefresh, signAccessToken, signRefreshToken } from "../utils/token";
import { UserModel } from "../models/User";
import { setAuthCookies } from "../utils/http";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; plan: string };
}

export async function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const accessToken = (req.cookies?.accessToken as string) || (req.headers.authorization?.split(" ")[1] ?? "");
  const refreshToken = (req.cookies?.refreshToken as string) || "";

  try {
    if (accessToken) {
      const payload = verifyAccess(accessToken);
      req.user = { id: payload.userId, email: payload.email, plan: payload.plan };
      return next();
    }
  } catch (err) {
    // try refresh
  }

  if (refreshToken) {
    try {
      const payload = verifyRefresh(refreshToken);
      const user = await UserModel.findById(payload.userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const newAccess = signAccessToken({
        userId: user.id,
        email: user.email,
        plan: user.subscriptionPlan,
      });
      const newRefresh = signRefreshToken({
        userId: user.id,
        email: user.email,
        plan: user.subscriptionPlan,
      });
      setAuthCookies(res, newAccess, newRefresh);
      req.user = { id: user.id, email: user.email, plan: user.subscriptionPlan };
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
}
