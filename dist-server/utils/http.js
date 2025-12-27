export function setAuthCookies(res, accessToken, refreshToken) {
    const isProd = process.env.NODE_ENV === "production";
    // In production with cross-site (Netlify frontend + different backend domain):
    // Use sameSite: "none" with secure: true
    // In development or same-site: use sameSite: "lax"
    const sameSite = isProd ? "none" : "lax";
    const secure = isProd; // Always secure in production
    
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite,
        secure,
        path: "/",
        maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite,
        secure,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
