import { getGmailAuthUrl } from "../config/google.js";
import {
  exchangeCodeForTokens,
  ensureGmailHealth,
  clearUserGmailTokens,
} from "../services/gmailService.js";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { GmailTokenModel } from "../models/GmailToken.js";

export async function debugConfig(req, res) {
  res.json({
    clientIdPrefix: (env.googleClientId || "").slice(0, 10),
    redirectUri: env.googleRedirectUri,
  });
}

export async function authUrl(req, res, next) {
  try {
    if (
      !env.googleClientId ||
      !env.googleClientSecret ||
      !env.googleRedirectUri
    ) {
      return res
        .status(500)
        .json({
          message:
            "Google OAuth misconfigured. Check GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI",
        });
    }
    const url = getGmailAuthUrl();
    res.json({ url });
  } catch (err) {
    next(err);
  }
}
export async function callback(req, res, next) {
  try {
    const { code, error } = req.query;
    
    // Handle OAuth error from Google
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[gmail] OAuth error:", error);
      const redirectUrl = `${
        env.primaryFrontendOrigin
      }/dashboard?gmail=error&reason=${encodeURIComponent(error)}`;
      return res.redirect(redirectUrl);
    }
    
    // Validate required parameters
    if (!code) {
      // eslint-disable-next-line no-console
      console.error("[gmail] callback missing code");
      return res.status(400).json({ 
        ok: false,
        message: "Missing authorization code" 
      });
    }
    
    if (!req.user || !req.user.id) {
      // eslint-disable-next-line no-console
      console.error("[gmail] callback missing authenticated user");
      return res.status(401).json({ 
        ok: false,
        message: "Authentication required. Please log in first." 
      });
    }
    
    // eslint-disable-next-line no-console
    console.log("[gmail] callback exchanging code for user", req.user.id);
    
    // Exchange code for tokens and store for this user
    const tokens = await exchangeCodeForTokens(String(code), req.user.id);
    
    if (!tokens || !tokens.access_token) {
      throw new Error("Failed to obtain access token from Google");
    }
    
    // Get the connected email from the token document
    const tokenDoc = await GmailTokenModel.findOne({ userId: req.user.id }).lean();
    const connectedEmail = tokenDoc?.googleEmail || "unknown";
    
    // eslint-disable-next-line no-console
    console.log("[gmail] callback complete for user", req.user.id, "email", connectedEmail);
    
    const redirectUrl = `${env.primaryFrontendOrigin}/dashboard?gmail=connected&email=${encodeURIComponent(connectedEmail)}`;
    res.redirect(redirectUrl);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gmail] callback error", {
      error: err?.message,
      code: err?.code,
      userId: req.user?.id,
    });
    
    const errorMessage = err?.message || "Failed to connect Gmail";
    const redirectUrl = `${env.primaryFrontendOrigin}/dashboard?gmail=error&reason=${encodeURIComponent(errorMessage)}`;
    return res.redirect(redirectUrl);
  }
}

export async function status(req, res, next) {
  try {
    const tokenDoc = await GmailTokenModel.findOne({ userId: req.user.id }).lean();
    const hasTokens = Boolean(tokenDoc?.accessToken && tokenDoc?.refreshToken);
    let connected = false;
    let needsReconnect = false;
    let reason = undefined;
    let gmailEmail = tokenDoc?.googleEmail || null;
    
    if (hasTokens) {
      const health = await ensureGmailHealth(req.user.id);
      if (health.ok) {
        connected = true;
      } else {
        connected = false;
        needsReconnect = health.reason !== "UNKNOWN";
        reason = health.reason;
        if (health.clearTokens) {
          await clearUserGmailTokens(req.user.id);
          gmailEmail = null;
        }
      }
    }
    res.json({
      connected,
      needsReconnect,
      reason,
      gmailEmail,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gmail] status error", err?.message || err);
    res.status(500).json({
      connected: false,
      needsReconnect: false,
      reason: "ERROR",
      gmailEmail: null,
      error: err?.message || "Failed to check Gmail status",
    });
  }
}

export async function disconnect(req, res, next) {
  try {
    await clearUserGmailTokens(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gmail] disconnect error", err?.message || err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to disconnect Gmail",
    });
  }
}
