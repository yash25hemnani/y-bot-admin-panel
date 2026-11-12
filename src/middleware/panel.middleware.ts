import { NextFunction, Request, Response } from "express";
import { RefreshToken, User } from "../db/models";
import { AuthRequest } from "../types/api.types";
import { PanelUser } from "../types/panel.types";
import { hashToken } from "../utils/tokens";

// The panel is server-rendered, so it can't hold a Bearer token like API clients do.
// Instead it keeps a refresh token (the same RefreshToken table the API uses) in an
// httpOnly cookie scoped to /panel, and looks the user up on each request.
export const PANEL_COOKIE = "ybot_panel";
export const PANEL_SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function loadPanelUser(req: AuthRequest, res: Response, next: NextFunction) {
  res.locals.user = null;
  const raw = req.cookies?.[PANEL_COOKIE];
  if (typeof raw !== "string" || raw.length === 0) return next();

  const token = await RefreshToken.findOne({
    where: { tokenHash: hashToken(raw), isRevoked: false },
    include: [{ model: User, as: "user", attributes: ["id", "username", "email", "role"] }],
  });

  if (token?.user && token.expiresAt > new Date()) {
    req.user = { id: token.user.id, role: token.user.role };
    const user: PanelUser = {
      id: token.user.id,
      username: token.user.username,
      email: token.user.email,
      role: token.user.role,
    };
    res.locals.user = user;
  }
  return next();
}

export function requirePanelUser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.redirect(303, "/panel/login");
  return next();
}

// The session cookie is SameSite=Lax, which already keeps it off cross-site POSTs.
// This is a second check that refuses POSTs another site started.
// Sec-Fetch-Site is the main signal: helmet's Referrer-Policy (no-referrer) makes
// browsers send "Origin: null" on our own form posts, so Origin is only used when real.
export function sameOriginPost(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST") return next();

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin" || fetchSite === "none" ? next() : refuse(res);
  }

  const origin = req.get("origin");
  if (!origin || origin === "null") return next();
  try {
    if (new URL(origin).host === req.get("host")) return next();
  } catch {
    // fall through to the refusal
  }
  return refuse(res);
}

function refuse(res: Response) {
  return res.status(403).send("Cross-site form submissions are not allowed.");
}
