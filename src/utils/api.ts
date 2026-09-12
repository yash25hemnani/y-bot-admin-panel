import { ApiResponse } from "../types/api";
import { Response } from "express";
import { logger } from "./logger";

export const unauthorized = (res: Response<ApiResponse>) =>
  res.status(403).json({
    success: false,
    error: {
      code: "AUTHENTICATION_FAILED",
      message: "User not authenticated.",
    },
  });

export const handleApiError = (
  res: Response<ApiResponse>,
  error: unknown,
  loggerMessage: string,
  errorCode = "INTERNAL_ERROR",
  errorMessage = "Internal server error",
) => {
  logger.error(error, loggerMessage);
  return res.status(500).json({
    success: false,
    error: { code: errorCode, message: errorMessage },
  });
};

