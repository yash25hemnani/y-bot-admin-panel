// Helpers shared by the panel controllers (src/controllers/panel/*).

import { Response } from "express";
import { Op, WhereOptions } from "sequelize";
import { AuditLog, Device } from "../db/models";
import {
  ActivityView,
  AuditLogWithUser,
  DeviceLogMetadata,
} from "../types/activity.types";
import { AuthRequest } from "../types/api.types";
import { NavKey, Pager } from "../types/panel.types";
import { dayLabel } from "./view.helpers";

// Every signed-in page renders inside layout.ejs, which includes pages/<page>.ejs
export function renderPage(
  res: Response,
  page: string,
  title: string,
  nav: NavKey | null,
  data: Record<string, unknown> = {},
) {
  res.render("layout", { title, nav, bodyPath: `pages/${page}`, ...data });
}

export function renderNotFound(res: Response) {
  res.status(404);
  renderPage(res, "not-found", "Not found", null);
}

export const isAdmin = (req: AuthRequest) => req.user?.role === "admin";

// Admins see every device and every log entry; everyone else sees only their own.
export const ownedBy = (req: AuthRequest): WhereOptions =>
  isAdmin(req) ? {} : { userId: req.user!.id };

export const toPager = (page: number, total: number, limit: number): Pager => ({
  page,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  total,
});

// Audit log entry -> one plain sentence. `target` is the device name when known.
function describeActivity(action: string, target: string | null): string {
  const device = target ? `“${target}”` : "a device that no longer exists";
  switch (action) {
    case "login":
      return "Signed in";
    case "logout":
      return "Signed out";
    case "device_created":
      return `Registered ${device}`;
    case "device_enabled":
      return `Switched on ${device}`;
    case "device_revoked":
      return `Switched off ${device}`;
    case "device_deleted":
      return `Deleted ${device}`;
    case "user_created":
      return "Created an account";
    case "user_updated":
      return "Updated an account";
    case "user_deleted":
      return "Deleted an account";
    default:
      return action.replace(/_/g, " ");
  }
}

// Turn audit rows into sentences. Device names are looked up in one query; a deleted
// device falls back to the name saved in the entry's metadata, if any.
export async function describeLogs(
  req: AuthRequest,
  logs: AuditLog[],
): Promise<ActivityView[]> {
  const deviceIds = logs
    .filter((log) => log.resourceType === "device" && log.resourceId)
    .map((log) => log.resourceId as string);

  const names = new Map<string, string>();
  if (deviceIds.length) {
    const devices = await Device.findAll({
      where: { id: { [Op.in]: [...new Set(deviceIds)] } },
      attributes: ["id", "deviceName"],
    });
    for (const device of devices) names.set(device.id, device.deviceName);
  }

  return logs.map((log) => {
    const meta = (log.metadata ?? {}) as DeviceLogMetadata;
    const target =
      log.resourceType === "device"
        ? (log.resourceId && names.get(log.resourceId)) ||
          meta.deviceName ||
          null
        : null;
    const user = (log as AuditLogWithUser).user;
    return {
      id: log.id,
      createdAt: log.get("createdAt") as Date,
      who: user?.username ?? "Deleted account",
      isSelf: log.userId === req.user?.id,
      text: describeActivity(log.action, target),
      kind: log.resourceType,
      ip: log.ipAddress,
    };
  });
}

// Consecutive entries grouped under a day heading (entries arrive newest first)
export function groupByDay<T extends { createdAt: Date }>(
  entries: T[],
): { label: string; entries: T[] }[] {
  const groups: { label: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}
