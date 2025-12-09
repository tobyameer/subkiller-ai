import { Request, Response, NextFunction } from "express";
import { getGmailAuthUrl } from "../config/google";
import { exchangeCodeForTokens } from "../services/gmailService";
import { AuthedRequest } from "../middleware/auth";
import { env } from "../config/env";

export async function authUrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const url = getGmailAuthUrl();
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function callback(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { code } = req.query;
    if (!code || !req.user) return res.status(400).json({ message: "Missing code" });
    const tokens = await exchangeCodeForTokens(String(code), req.user.id);
    const redirectUrl = `${env.frontendOrigin}/dashboard?gmail=connected`;
    res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
}
