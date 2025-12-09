import dotenv from "dotenv";
dotenv.config();
export const env = {
    port: process.env.PORT || "4000",
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/subkiller",
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
    stripePricePro: process.env.STRIPE_PRICE_PRO || "price_pro_placeholder",
    stripePricePremium: process.env.STRIPE_PRICE_PREMIUM || "price_premium_placeholder",
    openAiApiKey: process.env.OPENAI_API_KEY || "openai_api_key_placeholder",
    googleClientId: process.env.GOOGLE_CLIENT_ID || "google_client_id_placeholder",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "google_client_secret_placeholder",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/gmail/callback",
};
