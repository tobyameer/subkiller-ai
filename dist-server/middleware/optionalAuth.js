import {
  verifyAccess,
  verifyRefresh,
  signAccessToken,
  signRefreshToken,
} from "../utils/token.js";
import { UserModel } from "../models/User.js";
import { setAuthCookies } from "../utils/http.js";

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but continues if not authenticated
 * Unlike authMiddleware, this does NOT return 401 for unauthenticated requests
 */
export async function optionalAuthMiddleware(req, res, next) {
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
    // Try refresh token
  }

  if (refreshToken) {
    try {
      const payload = verifyRefresh(refreshToken);
      const user = await UserModel.findById(payload.userId);
      if (user) {
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
      }
    } catch (err) {
      // Invalid refresh token - continue without auth
    }
  }

  // No valid tokens - continue without setting req.user
  next();
}

