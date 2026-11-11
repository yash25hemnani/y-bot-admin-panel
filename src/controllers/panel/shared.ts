import { Response } from "express";
import { Op, WhereOptions } from "sequelize";
import { AuditLog, Device } from "../../db/models";
import { AuthRequest } from "../../types/api";
import { DeviceStatus, describeActivity } from "../../utils/view-helpers";
import { onlineDevices } from "../../ws/deviceSocket";

export type NavKey = "overview" | "devices" | "activity";

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

// ---------- Devices ----------

// Live status comes from the WebSocket server: a device is online while its socket is open.
export const onlineIds = () => [...onlineDevices.keys()];

export function statusOf(device: Pick<Device, "deviceId" | "isRevoked">): DeviceStatus {
  if (device.isRevoked) return "revoked";
  return onlineDevices.has(device.deviceId) ? "online" : "offline";
}

// Drop a device's live connection, e.g. after it is revoked or its key changes
export function disconnect(deviceId: string, reason: string) {
  onlineDevices.get(deviceId)?.close(4005, reason);
}

export interface DeviceView {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  status: DeviceStatus;
  owner: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export function toDeviceView(device: Device): DeviceView {
  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.deviceName,
    type: device.deviceType,
    status: statusOf(device),
    owner: device.user?.username ?? null,
    createdAt: device.createdAt,
    revokedAt: device.revokedAt,
  };
}

export interface DeviceCounts {
  total: number;
  online: number;
  offline: number;
  revoked: number;
}

export async function countDevices(req: AuthRequest, extra: WhereOptions = {}): Promise<DeviceCounts> {
  const where = { ...ownedBy(req), ...extra };
  const ids = onlineIds();
  const [total, revoked, online] = await Promise.all([
    Device.count({ where }),
    Device.count({ where: { ...where, isRevoked: true } }),
    ids.length
      ? Device.count({ where: { ...where, isRevoked: false, deviceId: { [Op.in]: ids } } })
      : Promise.resolve(0),
  ]);
  return { total, online, revoked, offline: total - online - revoked };
}

// ---------- Activity ----------

export interface ActivityView {
  id: string;
  createdAt: Date;
  who: string;
  isSelf: boolean;
  text: string;
  kind: string;
  ip: string | null;
}

// Only same-site panel paths, so a crafted form can't redirect anywhere else
export function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/panel") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function withNotice(path: string, notice: string): string {
  const url = new URL(path, "http://panel.local");
  url.searchParams.set("notice", notice);
  return url.pathname + url.search;
}

// Turn audit rows into sentences. Device names are looked up in one query; a deleted
// device falls back to the name saved in the entry's metadata, if any.
export async function describeLogs(req: AuthRequest, logs: AuditLog[]): Promise<ActivityView[]> {
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
    const meta = (log.metadata ?? {}) as { deviceName?: string };
    const target =
      log.resourceType === "device"
        ? (log.resourceId && names.get(log.resourceId)) || meta.deviceName || null
        : null;
    const user = (log as AuditLog & { user?: { username: string } }).user;
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
