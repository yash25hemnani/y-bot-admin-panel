import { ApiResponse } from "../types/api";
import { Response } from "express";

export const unauthorized = (res: Response<ApiResponse>) =>
  res.status(403).json({
    success: false,
    error: {
      code: "AUTHENTICATION_FAILED",
      message: "User not authenticated.",
    },
  });