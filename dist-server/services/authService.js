import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/token.js";

export async function registerUser(name, email, password, profile = {}) {
    if (!email || !password)
        throw { status: 400, message: "Email and password are required" };
    const existing = await UserModel.findOne({ email });
    if (existing)
        throw { status: 400, message: "Email already registered" };
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create(Object.assign({ name, email, passwordHash, plan: "free" }, profile));
    const accessToken = signAccessToken({ userId: user.id, email: user.email, plan: user.plan });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email, plan: user.plan });
    return { user, accessToken, refreshToken };
}
export async function loginUser(email, password) {
    if (!email || !password)
        throw { status: 400, message: "Email and password are required" };
    // Temporary diagnostics for signup/login issues
    // eslint-disable-next-line no-console
    console.log("[auth] login attempt", { email });
    const user = await UserModel.findOne({ email });
    // eslint-disable-next-line no-console
    console.log("[auth] user found?", !!user);
    if (!user)
        throw { status: 401, message: "Invalid credentials" };
    const ok = await bcrypt.compare(password, user.passwordHash);
    // eslint-disable-next-line no-console
    console.log("[auth] password match?", ok);
    if (!ok)
        throw { status: 401, message: "Invalid credentials" };
    const accessToken = signAccessToken({ userId: user.id, email: user.email, plan: user.plan });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email, plan: user.plan });
    return { user, accessToken, refreshToken };
}
export async function getUserById(userId) {
    return UserModel.findById(userId).lean();
}
