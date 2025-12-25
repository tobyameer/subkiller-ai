import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { backfillServiceNormalized } from "./models/Subscription.js";

const app = express();

const allowlist = env.frontendOrigins;
const isDev = process.env.NODE_ENV !== "production";

// CORS config: In dev, allow any localhost/127.0.0.1 port for Vite flexibility
// In prod, use strict allowlist from env
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow curl/postman

      // In development: allow any localhost/127.0.0.1 with any port
      if (isDev) {
        const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
        if (localhostRegex.test(origin)) {
          return cb(null, true);
        }
      }

      // Production: strict allowlist
      if (allowlist.includes(origin)) return cb(null, true);

      // eslint-disable-next-line no-console
      console.error("Blocked by CORS:", origin);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);
app.use(errorHandler);
const start = async () => {
  // Log Google OAuth config at startup (partial for safety)
  // eslint-disable-next-line no-console
  console.log(
    "[env] googleClientId prefix:",
    (env.googleClientId || "").slice(0, 10)
  );
  // eslint-disable-next-line no-console
  console.log("[env] googleRedirectUri:", env.googleRedirectUri);
  // eslint-disable-next-line no-console
  console.log("[env] frontendOrigin allowlist:", allowlist);
  await connectDb();
  // Run migration to backfill serviceNormalized for existing subscriptions
  try {
    await backfillServiceNormalized();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[startup] Migration failed (non-fatal):", err.message);
  }
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`SubKiller backend running on http://localhost:${env.port}`);
  });
};
start();
