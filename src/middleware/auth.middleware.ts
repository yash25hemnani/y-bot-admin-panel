import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ENV } from "../config/env";
import { ApiResponse, AuthRequest } from "../types/api";

interface TokenPayload extends JwtPayload {
  id: string;
  role: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction,
) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : undefined;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_HEADER",
          message: "Invalid Authorization header",
        },
      });
    }

    // Verify token
    const decoded = jwt.verify(token, ENV.JWT.ACCESS_SECRET) as TokenPayload;

    // Attach user to request
    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    return next();
  } catch (err: any) {
    // Handle JWT errors properly
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Token expired",
        },
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid Token",
        },
      });
    }

    return next(err);
  }
}