import { NextFunction, Response } from "express";
import { ApiResponse, AuthRequest } from "../types/api";
import { ENV } from "../config/env";

export async function prodDeleteGuardMiddleware(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction,
) {
  if (ENV.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      error: {
        code: "NOT_ALLOWED",
        message: "Deleting notifications is not allowed in production.",
      },
    });
  }
  next();
}