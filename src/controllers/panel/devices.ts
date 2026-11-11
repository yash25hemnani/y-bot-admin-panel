import bcrypt from "bcrypt";
import crypto from "crypto";
import { Response } from "express";
import { Op, WhereOptions } from "sequelize";
import { z } from "zod";
import { Device, User } from "../../db/models";
import { AuditAction, AuditResourceType } from "../../db/models/AuditLog";
import { AuthRequest } from "../../types/api";
import { createAuditLog } from "../../utils/audit";
import { getPaginationParams } from "../../utils/pagination";
import {
  countDevices,
  disconnect,
  isAdmin,
  onlineIds,
  ownedBy,
  renderNotFound,
  renderPage,
  safeReturnTo,
  toDeviceView,
  withNotice,
} from "./shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARDS = ["ESP32", "ARDUINO"] as const;
const STATUS_FILTERS = ["all", "online", "offline", "revoked"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const registerSchema = z.object({
  deviceName: z
    .string()
    .trim()
    .min(1, "Give the device a name.")
    .max(64, "Keep the name to 64 characters or fewer."),
  deviceType: z.enum(BOARDS, { error: "Choose the board this device uses." }),
  devicePassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Keep the password to 128 characters or fewer."),
});

type FieldErrors = Partial<Record<"deviceName" | "deviceType" | "devicePassword", string>>;

// Messages shown after a redirect, keyed by ?notice=
export const NOTICES: Record<string, { tone: "success" | "warning"; text: string }> = {
  revoked: { tone: "warning", text: "Device switched off. It was disconnected and can't sign in until you switch it back on." },
  enabled: { tone: "success", text: "Device switched on. It can sign in again with its current key." },
  "rotate-revoked": { tone: "warning", text: "Switch this device on before giving it a new key." },
  deleted: { tone: "success", text: "Device deleted." },
};

const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

async function findDevice(req: AuthRequest, id: string) {
  if (!UUID.test(id)) return null;
  return Device.findOne({
    where: { id, ...ownedBy(req) },
    include: [{ model: User, as: "user", attributes: ["username"] }],
  });
}

function renderDevice(
  req: AuthRequest,
  res: Response,
  device: Device,
  extra: { newSecret?: string; secretReason?: "created" | "rotated"; deleteError?: string } = {},
) {
  const notice = typeof req.query.notice === "string" ? NOTICES[req.query.notice] ?? null : null;
  renderPage(res, "device", device.deviceName, "devices", {
    admin: isAdmin(req),
    device: toDeviceView(device),
    notice,
    newSecret: null,
    secretReason: null,
    deleteError: null,
    ...extra,
  });
}

// ---------- List ----------

export const listDevices = async (req: AuthRequest, res: Response) => {
  const requested = String(req.query.status ?? "all");
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(requested)
    ? (requested as StatusFilter)
    : "all";
  const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 64) : "";
  const { page, limit, offset } = getPaginationParams({ page: req.query.page, limit: 20 });

  const searchWhere: WhereOptions = search
    ? { deviceName: { [Op.iLike]: `%${escapeLike(search)}%` } }
    : {};

  const ids = onlineIds();
  const statusWhere: Record<StatusFilter, WhereOptions> = {
    all: {},
    revoked: { isRevoked: true },
    online: { isRevoked: false, deviceId: { [Op.in]: ids } },
    offline: ids.length ? { isRevoked: false, deviceId: { [Op.notIn]: ids } } : { isRevoked: false },
  };

  const admin = isAdmin(req);
  const [counts, { count, rows }] = await Promise.all([
    countDevices(req, searchWhere),
    Device.findAndCountAll({
      where: { ...ownedBy(req), ...searchWhere, ...statusWhere[status] },
      attributes: { exclude: ["devicePasswordHash", "hmacSecret"] },
      include: admin ? [{ model: User, as: "user", attributes: ["username"] }] : [],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    }),
  ]);

  const notice = typeof req.query.notice === "string" ? NOTICES[req.query.notice] ?? null : null;

  renderPage(res, "devices", "Devices", "devices", {
    admin,
    status,
    search,
    counts,
    notice,
    hasAnyDevice: (await Device.count({ where: ownedBy(req) })) > 0,
    devices: rows.map(toDeviceView),
    pager: { page, totalPages: Math.max(1, Math.ceil(count / limit)), total: count },
  });
};

// ---------- Register ----------

export const renderNewDevice = (req: AuthRequest, res: Response) => {
  renderPage(res, "device-new", "Register device", "devices", {
    values: { deviceName: "", deviceType: "ESP32" },
    errors: {},
  });
};

export const registerDevice = async (req: AuthRequest, res: Response) => {
  const values = {
    deviceName: typeof req.body?.deviceName === "string" ? req.body.deviceName : "",
    deviceType: typeof req.body?.deviceType === "string" ? req.body.deviceType : "ESP32",
  };
  const parsed = registerSchema.safeParse(req.body ?? {});
  const errors: FieldErrors = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof FieldErrors;
      errors[field] ??= issue.message;
    }
  } else {
    const taken = await Device.findOne({
      where: { deviceName: parsed.data.deviceName, userId: req.user!.id },
    });
    if (taken) errors.deviceName = "You already have a device with this name.";
  }

  if (!parsed.success || Object.keys(errors).length) {
    res.status(400);
    return renderPage(res, "device-new", "Register device", "devices", { values, errors });
  }

  const { deviceName, deviceType, devicePassword } = parsed.data;
  const hmacSecret = crypto.randomBytes(32).toString("hex");

  const created = await Device.create({
    deviceName,
    deviceType,
    deviceId: crypto.randomUUID(),
    devicePasswordHash: await bcrypt.hash(devicePassword, 10),
    hmacSecret,
    userId: req.user!.id,
  });

  await createAuditLog(req, {
    action: AuditAction.DEVICE_CREATED,
    resourceType: AuditResourceType.DEVICE,
    resourceId: created.id,
    metadata: { deviceName },
  });

  const device = await findDevice(req, created.id);
  res.status(201);
  return renderDevice(req, res, device!, { newSecret: hmacSecret, secretReason: "created" });
};

// ---------- One device ----------

export const showDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req, String(req.params.id));
  if (!device) return renderNotFound(res);
  return renderDevice(req, res, device);
};

export const revokeDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req, String(req.params.id));
  if (!device) return renderNotFound(res);

  if (!device.isRevoked) {
    await device.update({ isRevoked: true, revokedAt: new Date() });
    disconnect(device.deviceId, "revoked");
    await createAuditLog(req, {
      action: AuditAction.DEVICE_REVOKED,
      resourceType: AuditResourceType.DEVICE,
      resourceId: device.id,
      metadata: { deviceName: device.deviceName },
    });
  }
  const back = safeReturnTo(req.body?.returnTo, `/panel/devices/${device.id}`);
  return res.redirect(303, withNotice(back, "revoked"));
};

export const enableDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req, String(req.params.id));
  if (!device) return renderNotFound(res);

  if (device.isRevoked) {
    await device.update({ isRevoked: false, revokedAt: null });
    await createAuditLog(req, {
      action: AuditAction.DEVICE_ENABLED,
      resourceType: AuditResourceType.DEVICE,
      resourceId: device.id,
      metadata: { deviceName: device.deviceName },
    });
  }
  const back = safeReturnTo(req.body?.returnTo, `/panel/devices/${device.id}`);
  return res.redirect(303, withNotice(back, "enabled"));
};

// New HMAC key. The old one stops working at once, so the live connection is dropped.
// (Not written to the audit log: AuditAction has no value for it yet.)
export const rotateDeviceKey = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req, String(req.params.id));
  if (!device) return renderNotFound(res);
  if (device.isRevoked) return res.redirect(303, `/panel/devices/${device.id}?notice=rotate-revoked`);

  const hmacSecret = crypto.randomBytes(32).toString("hex");
  await device.update({ hmacSecret });
  disconnect(device.deviceId, "key rotated");

  return renderDevice(req, res, device, { newSecret: hmacSecret, secretReason: "rotated" });
};

// Deleting needs the device password, the same rule as DELETE in the API
export const deleteDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req, String(req.params.id));
  if (!device) return renderNotFound(res);

  const password = typeof req.body?.devicePassword === "string" ? req.body.devicePassword : "";
  const valid = password.length > 0 && (await bcrypt.compare(password, device.devicePasswordHash));

  if (!valid) {
    res.status(403);
    return renderDevice(req, res, device, {
      deleteError: password ? "That password doesn't match this device." : "Enter the device password.",
    });
  }

  await device.destroy();
  disconnect(device.deviceId, "deleted");
  await createAuditLog(req, {
    action: AuditAction.DEVICE_DELETED,
    resourceType: AuditResourceType.DEVICE,
    resourceId: device.id,
    metadata: { deviceName: device.deviceName },
  });

  return res.redirect(303, "/panel/devices?notice=deleted");
};
