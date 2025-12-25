import "dotenv/config";

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
}

export const env = {
  port: process.env.PORT || "4000",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/subkiller",
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  frontendOrigin:
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
  frontendOrigins: (
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  primaryFrontendOrigin:
    (
      process.env.FRONTEND_ORIGIN ||
      "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    )
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)[0] || "http://localhost:5173",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePricePro: process.env.STRIPE_PRICE_PRO || "",
  stripePricePremium: process.env.STRIPE_PRICE_PREMIUM || "",
  openAiApiKey: requireEnv("OPENAI_API_KEY"),
  googleClientId: requireEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
  plaidClientId: process.env.PLAID_CLIENT_ID || "",
  plaidSecret: process.env.PLAID_SECRET || "",
  plaidEnv: process.env.PLAID_ENV || "sandbox",
};
