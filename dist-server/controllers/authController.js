

import { loginUser, registerUser, getUserById } from "../services/authService.js";
import { setAuthCookies } from "../utils/http.js";

function sanitizeUser(user) {
    if (!user)
        return user;
    // Avoid leaking password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user.toObject ? user.toObject() : user;
    return rest;
}
export async function register(req, res, next) {
    try {
        const { name, email, password, firstName, lastName, gender, dob, country, marketingOptIn } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }
        const profile = {
            firstName,
            lastName,
            gender,
            dob: dob ? new Date(dob) : undefined,
            country,
            marketingOptIn: Boolean(marketingOptIn),
        };
        const { user, accessToken, refreshToken } = await registerUser(name, email, password, profile);
        setAuthCookies(res, accessToken, refreshToken);
        res.status(201).json({ user: sanitizeUser(user) });
    }
    catch (err) {
        next(err);
    }
}
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const { user, accessToken, refreshToken } = await loginUser(email, password);
        setAuthCookies(res, accessToken, refreshToken);
        res.json({ user: sanitizeUser(user) });
    }
    catch (err) {
        next(err);
    }
}
export async function me(req, res, next) {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const user = await getUserById(req.user.id);
        res.json({ user: sanitizeUser(user) });
    }
    catch (err) {
        next(err);
    }
}
export async function logout(req, res, next) {
    try {
        const isProd = process.env.NODE_ENV === "production";
        // In production with cross-site: use sameSite: "none" with secure: true
        // In development or same-site: use sameSite: "lax"
        const sameSite = isProd ? "none" : "lax";
        const secure = isProd; // Always secure in production
        const cookieOptions = {
            httpOnly: true,
            sameSite,
            secure,
            path: "/",
        };
        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
}
