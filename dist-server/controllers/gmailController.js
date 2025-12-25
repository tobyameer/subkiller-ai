import { getGmailAuthUrl } from "../config/google.js";
import {
  exchangeCodeForTokens,
  ensureGmailHealth,
  clearUserGmailTokens,
} from "../services/gmailService.js";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";

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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "gmailController.js:30",
        message: "callback entry",
        data: {
          query: req.query,
          hasUser: !!req.user,
          userId: req.user?.id,
          queryKeys: Object.keys(req.query || {}),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H1,H2,H4,H5",
      }),
    }).catch(() => {});
    // #endregion
    const { code, error } = req.query;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "gmailController.js:33",
        message: "after query extraction",
        data: {
          hasCode: !!code,
          hasError: !!error,
          errorValue: error,
          codeValue: code?.substring(0, 20),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H1",
      }),
    }).catch(() => {});
    // #endregion
    if (error) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "gmailController.js:36",
            message: "OAuth error detected",
            data: { error, allQuery: req.query },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "H1",
          }),
        }
      ).catch(() => {});
      // #endregion
      const redirectUrl = `${
        env.primaryFrontendOrigin
      }/dashboard?gmail=error&reason=${encodeURIComponent(error)}`;
      return res.redirect(redirectUrl);
    }
    if (!code || !req.user) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "gmailController.js:42",
            message: "missing code or user",
            data: { hasCode: !!code, hasUser: !!req.user, query: req.query },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "H2,H4",
          }),
        }
      ).catch(() => {});
      // #endregion
      return res.status(400).json({ message: "Missing code" });
    }
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "gmailController.js:46",
        message: "before exchangeCodeForTokens",
        data: {
          userId: req.user.id,
          codeLength: code?.length,
          redirectUri: env.googleRedirectUri,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    // eslint-disable-next-line no-console
    console.log(
      "[gmail] callback exchanging code using client",
      (env.googleClientId || "").slice(0, 10),
      "redirect",
      env.googleRedirectUri
    );
    const tokens = await exchangeCodeForTokens(String(code), req.user.id);
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "gmailController.js:50",
        message: "after exchangeCodeForTokens",
        data: { hasTokens: !!tokens, hasAccessToken: !!tokens?.access_token },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    // eslint-disable-next-line no-console
    console.log(
      "[gmail] callback complete for user",
      req.user.id,
      "tokens received",
      Boolean(tokens.access_token)
    );
    const redirectUrl = `${env.primaryFrontendOrigin}/dashboard?gmail=connected`;
    res.redirect(redirectUrl);
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/56b4ddea-2e27-4d85-b699-499476c203a6", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "gmailController.js:56",
        message: "callback catch block",
        data: {
          error: err?.message,
          errorStack: err?.stack?.substring(0, 200),
          errorCode: err?.code,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    // eslint-disable-next-line no-console
    console.error("[gmail] callback error", err?.message || err);
    const redirectUrl = `${env.primaryFrontendOrigin}/dashboard?gmail=error`;
    return res.redirect(redirectUrl);
  }
}

export async function status(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id)
      .select(["gmailTokens", "gmailConnected", "gmailEmail"])
      .lean();
    const hasTokens = Boolean(
      user?.gmailTokens?.refresh || user?.gmailTokens?.access
    );
    let connected = false;
    let needsReconnect = false;
    let reason = undefined;
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
        }
      }
    }
    res.json({
      connected,
      needsReconnect,
      reason,
      gmailEmail: user?.gmailEmail,
    });
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    await clearUserGmailTokens(req.user.id);
    await UserModel.findByIdAndUpdate(req.user.id, { gmailEmail: null });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
