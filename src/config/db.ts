import mongoose from "mongoose";
import { env } from "./env";

export async function connectDb() {
  try {
    await mongoose.connect(env.mongoUri);
    // eslint-disable-next-line no-console
    console.log("Connected to MongoDB");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Mongo connection error", err);
    process.exit(1);
  }
}
