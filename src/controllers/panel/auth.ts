import bcrypt from "bcrypt";
import { Response } from "express";
import { ENV } from "../../config/env";
import { RefreshToken, User } from "../../db/models";
import { AuditAction, AuditResourceType } from "../../db/models/AuditLog";
import { PANEL_COOKIE, PANEL_SESSION_MS } from "../../middleware/panel.middleware";
import { panelLoginSchema, panelLoginValuesSchema } from "../../schemas/panel.schema";
import { AuthRequest } from "../../types/api.types";
import { createAuditLog } from "../../utils/audit";
import { generateRefreshToken, hashToken } from "../../utils/tokens";

// Compared against when the email is unknown, so both failures take the same time
// and response times don't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: ENV.NODE_ENV === "production",
  path: "/panel",
};

// GET /panel/login: the sign-in form
export const renderLogin = (req: AuthRequest, res: Response) => {
  if (req.user) return res.redirect(303, "/panel");
  res.render("login", { error: null, email: "" });
};

// POST /panel/login: check the password, start a session and set the panel cookie
export const panelLogin = async (req: AuthRequest, res: Response) => {
  const { email } = panelLoginValuesSchema.parse(req.body ?? {});
  const parsed = panelLoginSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).render("login", { error: "Enter your email address and password.", email });
  }

  const user = await User.findOne({ where: { email: parsed.data.email } });
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    return res.status(401).render("login", { error: "That email and password don't match an account.", email });
  }

  const raw = generateRefreshToken();
  await RefreshToken.create({
    userId: user.id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + PANEL_SESSION_MS),
  });

  res.cookie(PANEL_COOKIE, raw, { ...cookieOptions, maxAge: PANEL_SESSION_MS });

  await createAuditLog(req, {
    action: AuditAction.LOGIN,
    resourceType: AuditResourceType.AUTH,
    userId: user.id,
    metadata: { via: "panel" },
  });

  return res.redirect(303, "/panel");
};

// POST /panel/logout: end the session and clear the panel cookie
export const panelLogout = async (req: AuthRequest, res: Response) => {
  const raw = req.cookies?.[PANEL_COOKIE];
  if (typeof raw === "string" && raw) {
    await RefreshToken.update({ isRevoked: true }, { where: { tokenHash: hashToken(raw) } });
    await createAuditLog(req, {
      action: AuditAction.LOGOUT,
      resourceType: AuditResourceType.AUTH,
      metadata: { via: "panel" },
    });
  }
  res.clearCookie(PANEL_COOKIE, cookieOptions);
  return res.redirect(303, "/panel/login");
};
