import {
  verifyAccess,
  verifyRefresh,
  signAccessToken,
  signRefreshToken,
} from "../utils/token.js";
import { UserModel } from "../models/User.js";
import { setAuthCookies } from "../utils/http.js";

export async function authMiddleware(req, res, next) {
  const accessToken =
    req.cookies?.accessToken ||
    (req.headers.authorization?.split(" ")[1] ?? "");
  const refreshToken = req.cookies?.refreshToken || "";
  try {
    if (accessToken) {
      const payload = verifyAccess(accessToken);
      req.user = {
        id: payload.userId,
        email: payload.email,
        plan: payload.plan,
      };
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
        plan: user.plan,
      });
      const newRefresh = signRefreshToken({
        userId: user.id,
        email: user.email,
        plan: user.plan,
      });
      setAuthCookies(res, newAccess, newRefresh);
      req.user = { id: user.id, email: user.email, plan: user.plan };
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }
  // Log auth failures for debugging
  if (process.env.LOG_SCAN_DEBUG === "true") {
    // eslint-disable-next-line no-console
    console.log("[auth] Request blocked - missing/invalid tokens", {
      path: req.path,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      cookies: Object.keys(req.cookies || {}),
    });
  }
  return res.status(401).json({ message: "Unauthorized" });
}
