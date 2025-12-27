/**
 * Middleware to check if database is connected
 * Returns 503 if DB is not connected
 */

import { isDbConnected } from "../config/db.js";

export function requireDb(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({
      message: "Database unavailable",
      error: "The database is not connected. Please check your MongoDB connection.",
    });
  }
  next();
}

