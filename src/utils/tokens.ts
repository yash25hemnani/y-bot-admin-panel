// utils/tokens.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ENV } from "../config/env";

const ACCESS_SECRET = ENV.JWT.ACCESS_SECRET!;
// const REFRESH_SECRET = ENV.JWT.REFRESH_SECRET!;

// Generate access token signed with userId
export const generateAccessToken = (user: { id: string; role: string }) => {
  return jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

// Non-JWT Refresh token
export const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex"); // NOT JWT
};

export const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};