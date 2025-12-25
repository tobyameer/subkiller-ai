import { google } from "googleapis";
import { env } from "./env.js";

function validateGoogleEnv() {
    if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) {
        // eslint-disable-next-line no-console
        console.error("[google] Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI");
        throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI");
    }
}

validateGoogleEnv();
// eslint-disable-next-line no-console
console.log("[google] redirectUri:", env.googleRedirectUri);

const oauth2Client = new google.auth.OAuth2({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: env.googleRedirectUri,
});
export function getGmailAuthUrl() {
    const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid",
        "email",
        "profile",
    ];
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
    });
}
export function getGoogleClient() {
    return oauth2Client;
}
