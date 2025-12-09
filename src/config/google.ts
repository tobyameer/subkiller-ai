import { google } from "googleapis";
import { env } from "./env";

const oauth2Client = new google.auth.OAuth2({
  clientId: env.googleClientId,
  clientSecret: env.googleClientSecret,
  redirectUri: env.googleRedirectUri,
});

export function getGmailAuthUrl() {
  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
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
