import { Request, Response, NextFunction } from "express";
import { loginUser, registerUser, getUserById } from "../services/authService";
import { setAuthCookies } from "../utils/http";
import { AuthedRequest } from "../middleware/auth";

function sanitizeUser(user: any) {
  if (!user) return user;
  // Avoid leaking password hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user.toObject ? user.toObject() : user;
  return rest;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    const { user, accessToken, refreshToken } = await registerUser(name, email, password);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await loginUser(email, password);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const user = await getUserById(req.user.id);
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}
