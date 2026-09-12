import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { RefreshToken, User } from "../db/models";
import { ApiResponse } from "../types/api";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/tokens";
import { logger } from "../utils/logger";
import { ENV } from "../config/env";

const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export const handleSignup = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { email, username, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "USER_ALREADY_EXISTS",
          message: "User with this email already exists.",
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      username,
      passwordHash: hashedPassword,
    });

    const accessToken = generateAccessToken({
      id: newUser.id,
      role: newUser.role,
    });

    const refreshToken = generateRefreshToken();

    await RefreshToken.create({
      userId: newUser.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: ENV.NODE_ENV === "production" ? "lax" : "none",
      maxAge: REFRESH_TOKEN_EXPIRY,
    });

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
        },
        accessToken: accessToken,
      },
    });
  } catch (error) {
    logger.error(error, "Signup failed");
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

export const handleLogin = async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "No user found with this email.",
        },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(403).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect password.",
        },
      });
    }

    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: "MISSING_TOKEN", message: "No refresh token provided" },
      });
    }

    await RefreshToken.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: ENV.NODE_ENV === "production" ? "lax" : "none",
      maxAge: REFRESH_TOKEN_EXPIRY,
    });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        accessToken: accessToken,
      },
    });
  } catch (error) {
    logger.error(error, "Login failed");
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

export const handleRefresh = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    // Get refresh token from cookies
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_TOKEN",
          message: "Refresh token not provided",
        },
      });
    }

    const hashed = hashToken(refreshToken);

    // Find token
    const token = await RefreshToken.findOne({
      where: { tokenHash: hashed, isRevoked: false },
      include: [{ model: User, as: "user" }],
    });

    // If not token, then return error
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid Refresh Token",
        },
      });
    }

    if (new Date() > token?.expiresAt) {
      return res.status(401).json({
        success: false,
        error: {
          code: "EXPIRED_TOKEN",
          message: "Referesh Token Expired",
        },
      });
    }

    const accessToken = generateAccessToken({
      id: token.userId,
      role: !!token.user ? token.user.role : "",
    });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: token.user?.id,
          email: token.user?.email,
          username: token.user?.username,
          role: token.user?.role,
        },
        accessToken: accessToken,
      },
    });
  } catch (error) {
    logger.error(error, "Refresh failed");
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

export const handleLogout = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    // Get refresh token from cookies
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(200).json({
        success: true,
        data: { message: "Already logged out" },
      });
    }

    // Revoke the token in database
    const hashed = hashToken(refreshToken);
    await RefreshToken.update(
      { isRevoked: true },
      { where: { tokenHash: hashed } },
    );

    // Clear cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: ENV.NODE_ENV === "production" ? "lax" : "none",
      secure: ENV.NODE_ENV === "production",
    });

    return res.status(200).json({
      success: true,
      data: { message: "Logged out successfully" },
    });
  } catch (error) {
    logger.error(error, "Logout failed");
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};
