import { NextFunction, Request, Response } from "express";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  // eslint-disable-next-line no-console
  console.error("Error handler:", err);
  res.status(status).json({ message, details: err.details });
}
