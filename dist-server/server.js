// Load environment variables first
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { connectDb, isDbConnected } from "./config/db.js";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { backfillServiceNormalized } from "./models/Subscription.js";
import { generalLimiter } from "./middleware/rateLimit.js";

const app = express();

const allowlist = env.frontendOrigins;
const isDev = process.env.NODE_ENV !== "production";
// Use process.env.PORT (required by Render/Railway/Fly) with fallback
const PORT = parseInt(process.env.PORT || env.port, 10) || 4000;
const serverStartTime = Date.now();

// CORS config: In dev, allow any localhost/127.0.0.1 port for Vite flexibility
// In prod, use strict allowlist from env (CORS_ORIGINS or FRONTEND_ORIGIN)
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

      // Production: strict allowlist from CORS_ORIGINS or FRONTEND_ORIGIN
      if (allowlist.includes(origin)) return cb(null, true);

      // eslint-disable-next-line no-console
      console.error("[cors] Blocked origin:", origin);
      // eslint-disable-next-line no-console
      console.error("[cors] Allowed origins:", allowlist);
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

// Health endpoint (before routes and rate limiting, works even if DB is down)
app.get("/api/health", (_req, res) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // seconds
  res.json({
    ok: true,
    time: new Date().toISOString(),
    uptime,
    env: process.env.NODE_ENV || "development",
    db: isDbConnected() ? "connected" : "disconnected",
  });
});

// Apply general rate limiting to all API routes (health is excluded as it's before this)
app.use("/api", generalLimiter);

app.use("/api", routes);
app.use(errorHandler);

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error(
    "[unhandledRejection] Unhandled Rejection at:",
    promise,
    "reason:",
    reason
  );
});

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException] Uncaught Exception:", error);
  process.exit(1);
});

const start = async () => {
  try {
    // Log startup config
    // eslint-disable-next-line no-console
    console.log("=".repeat(50));
    // eslint-disable-next-line no-console
    console.log("[startup] SubKiller Backend Starting...");
    // eslint-disable-next-line no-console
    console.log("[startup] PORT:", PORT);
    // eslint-disable-next-line no-console
    console.log("[startup] NODE_ENV:", process.env.NODE_ENV || "development");
    // eslint-disable-next-line no-console
    console.log(
      "[startup] MONGO_URI:",
      env.mongoUri?.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
    ); // Hide credentials
    // eslint-disable-next-line no-console
    console.log("[startup] CORS Origins:", allowlist.join(", "));
    // eslint-disable-next-line no-console
    console.log("[startup] CORS Source:", process.env.CORS_ORIGINS ? "CORS_ORIGINS" : process.env.FRONTEND_ORIGIN ? "FRONTEND_ORIGIN" : "default (localhost)");
    // eslint-disable-next-line no-console
    console.log("[startup] Google OAuth configured:", !!env.googleClientId);

    // Email service configuration status (Resend API)
    const resendConfigured = !!process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "no-reply@subkiller.app";
    const isProduction = process.env.NODE_ENV === "production";
    
    // eslint-disable-next-line no-console
    console.log("[startup] Email service: Resend");
    if (resendConfigured) {
      // eslint-disable-next-line no-console
      console.log("[startup] RESEND_API_KEY: configured");
      // eslint-disable-next-line no-console
      console.log("[startup] EMAIL_FROM:", emailFrom);
    } else {
      // eslint-disable-next-line no-console
      console.log("[startup] RESEND_API_KEY: not set (emails will be logged only)");
      // eslint-disable-next-line no-console
      console.log("[startup] EMAIL_FROM:", emailFrom);
    }
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.log("[startup] Development mode: emails will be logged (not sent)");
    }
    // eslint-disable-next-line no-console
    console.log("=".repeat(50));

    // Connect to MongoDB (non-blocking)
    const dbConnected = await connectDb();

    // Run migration if DB is connected
    if (dbConnected) {
      try {
        await backfillServiceNormalized();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[startup] Migration failed (non-fatal):", err.message);
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "[startup] Starting server in degraded mode (MongoDB not connected)"
      );
      // eslint-disable-next-line no-console
      console.warn(
        "[startup] Database routes will return 503, but /api/health will work"
      );
    }

    // Start server (don't wait for DB)
    const server = app.listen(PORT, "0.0.0.0", () => {
      // eslint-disable-next-line no-console
      console.log("=".repeat(50));
      // eslint-disable-next-line no-console
      console.log(
        `[startup] ✅ SubKiller backend running on http://localhost:${PORT}`
      );
      // eslint-disable-next-line no-console
      console.log(
        `[startup] Health check: http://localhost:${PORT}/api/health`
      );
      // eslint-disable-next-line no-console
      console.log(
        `[startup] MongoDB: ${dbConnected ? "✅ Connected" : "❌ Disconnected"}`
      );
      // eslint-disable-next-line no-console
      console.log("=".repeat(50));
    });

    // Handle server errors
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        // eslint-disable-next-line no-console
        console.error(`[startup] ❌ Port ${PORT} is already in use`);
        // eslint-disable-next-line no-console
        console.error(`[startup] Try one of these:`);
        // eslint-disable-next-line no-console
        console.error(
          `[startup]   1. Kill the process using port ${PORT}: lsof -ti:${PORT} | xargs kill -9`
        );
        // eslint-disable-next-line no-console
        console.error(
          `[startup]   2. Use a different port: PORT=4001 npm run dev:server`
        );
        process.exit(1);
      } else {
        // eslint-disable-next-line no-console
        console.error("[startup] Server error:", error);
        process.exit(1);
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[startup] ❌ Failed to start server:", error.message);
    if (error.message.includes("Missing required env var")) {
      // eslint-disable-next-line no-console
      console.error(
        "[startup] Please check your .env file and ensure all required variables are set"
      );
    }
    process.exit(1);
  }
};

start();
