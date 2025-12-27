import mongoose from "mongoose";
import { env } from "./env.js";

let dbConnected = false;
let dbConnectionError = null;

export async function connectDb() {
  try {
    await mongoose.connect(env.mongoUri);
    dbConnected = true;
    dbConnectionError = null;
    // eslint-disable-next-line no-console
    console.log("[db] Connected to MongoDB");
    return true;
  } catch (err) {
    dbConnected = false;
    dbConnectionError = err;
    // eslint-disable-next-line no-console
    console.error("[db] MongoDB connection error:", err.message);
    // Don't exit - let server start in degraded mode
    return false;
  }
}

export function isDbConnected() {
  return dbConnected;
}

export function getDbConnectionError() {
  return dbConnectionError;
}
