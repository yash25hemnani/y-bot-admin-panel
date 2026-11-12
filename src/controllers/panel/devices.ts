import bcrypt from "bcrypt";
import crypto from "crypto";
import { Response } from "express";
import { Op, WhereOptions } from "sequelize";
import { Device, User } from "../../db/models";
import { AuditAction, AuditResourceType } from "../../db/models/AuditLog";
import {
  DeviceStatusFilter,
  RegisterDeviceFieldErrors,
  deleteDeviceBodySchema,
  deviceListQuerySchema,
  deviceNoticeQuerySchema,
  deviceParamsSchema,
  registerDeviceSchema,
  registerDeviceValuesSchema,
  returnToBodySchema,
} from "../../schemas/panel.schema";
import { AuthRequest } from "../../types/api.types";
import { DevicePageExtras } from "../../types/device.types";
import { createAuditLog } from "../../utils/audit";
import { getPaginationParams } from "../../utils/pagination";
import { generateHmacSecret } from "../../utils/tokens";
import {
  countDevices,
  noticeFor,
  onlineIds,
  toDeviceView,
} from "../../helpers/device.helpers";
import {
  isAdmin,
  ownedBy,
  renderNotFound,
  renderPage,
  toPager,
} from "../../helpers/panel.helpers";
import { disconnectDevice } from "../../ws/deviceSocket";

// Only same-site panel paths, so a crafted form can't redirect anywhere else
function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (
    !value.startsWith("/panel") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return fallback;
  return value;
}

// Add ?notice= to a path so the next page shows a message
function withNotice(path: string, notice: string): string {
  const url = new URL(path, "http://panel.local");
  url.searchParams.set("notice", notice);
  return url.pathname + url.search;
}

// Escape LIKE wildcards so a search for "50%" matches literally
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

// A device by primary key, with its owner, if this user may see it
const loadDevice = (req: AuthRequest, id: string) =>
  Device.findOne({
    where: { id, ...ownedBy(req) },
    include: [{ model: User, as: "user", attributes: ["username"] }],
  });

// The device from :id, if the id is valid, the device exists and this user may see it
async function findDevice(req: AuthRequest) {
  const params = deviceParamsSchema.safeParse(req.params);
  return params.success ? loadDevice(req, params.data.id) : null;
}

// Where to go after a device action: the form's returnTo, else the device page
const returnPath = (req: AuthRequest, device: Device) =>
  safeReturnTo(
    returnToBodySchema.parse(req.body ?? {}).returnTo,
    `/panel/devices/${device.id}`,
  );

// Render the device page; `extra` carries a new secret or a delete error
function renderDevice(
  req: AuthRequest,
  res: Response,
  device: Device,
  extra: DevicePageExtras = {},
) {
  renderPage(res, "device", device.deviceName, "devices", {
    admin: isAdmin(req),
    device: toDeviceView(device),
    notice: noticeFor(deviceNoticeQuerySchema.parse(req.query).notice),
    newSecret: null,
    secretReason: null,
    deleteError: null,
    ...extra,
  });
}

// GET /panel/devices: search, status tabs and pages
export const listDevices = async (req: AuthRequest, res: Response) => {
  const query = deviceListQuerySchema.parse(req.query);
  const { status, q: search } = query;
  const { page, limit, offset } = getPaginationParams({
    page: query.page,
    limit: 20,
  });

  const searchWhere: WhereOptions = search
    ? { deviceName: { [Op.iLike]: `%${escapeLike(search)}%` } }
    : {};

  const ids = onlineIds();
  const statusWhere: Record<DeviceStatusFilter, WhereOptions> = {
    all: {},
    revoked: { isRevoked: true },
    online: { isRevoked: false, deviceId: { [Op.in]: ids } },
    offline: ids.length
      ? { isRevoked: false, deviceId: { [Op.notIn]: ids } }
      : { isRevoked: false },
  };

  const admin = isAdmin(req);
  const [counts, { count, rows }] = await Promise.all([
    countDevices(req, searchWhere),
    Device.findAndCountAll({
      where: { ...ownedBy(req), ...searchWhere, ...statusWhere[status] },
      attributes: { exclude: ["devicePasswordHash", "hmacSecret"] },
      include: admin
        ? [{ model: User, as: "user", attributes: ["username"] }]
        : [],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    }),
  ]);

  renderPage(res, "devices", "Devices", "devices", {
    admin,
    status,
    search,
    counts,
    notice: noticeFor(query.notice),
    hasAnyDevice: (await Device.count({ where: ownedBy(req) })) > 0,
    devices: rows.map(toDeviceView),
    pager: toPager(page, count, limit),
  });
};

// GET /panel/devices/new: the empty registration form
export const renderNewDevice = (req: AuthRequest, res: Response) => {
  renderPage(res, "device-new", "Register device", "devices", {
    values: { deviceName: "", deviceType: "ESP32" },
    errors: {},
  });
};

// POST /panel/devices: validate, create the device and show its secret once
export const registerDevice = async (req: AuthRequest, res: Response) => {
  const values = registerDeviceValuesSchema.parse(req.body ?? {});
  const parsed = registerDeviceSchema.safeParse(req.body ?? {});
  const errors: RegisterDeviceFieldErrors = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof RegisterDeviceFieldErrors;
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
    return renderPage(res, "device-new", "Register device", "devices", {
      values,
      errors,
    });
  }

  const { deviceName, deviceType, devicePassword } = parsed.data;
  const hmacSecret = generateHmacSecret();

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

  const device = await loadDevice(req, created.id);
  res.status(201);
  return renderDevice(req, res, device!, {
    newSecret: hmacSecret,
    secretReason: "created",
  });
};

// GET /panel/devices/:id: one device
export const showDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req);
  if (!device) return renderNotFound(res);
  return renderDevice(req, res, device);
};

// POST /panel/devices/:id/revoke: switch the device off and disconnect it
export const revokeDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req);
  if (!device) return renderNotFound(res);

  if (!device.isRevoked) {
    await device.update({ isRevoked: true, revokedAt: new Date() });
    disconnectDevice(device.deviceId, "revoked");
    await createAuditLog(req, {
      action: AuditAction.DEVICE_REVOKED,
      resourceType: AuditResourceType.DEVICE,
      resourceId: device.id,
      metadata: { deviceName: device.deviceName },
    });
  }
  return res.redirect(303, withNotice(returnPath(req, device), "revoked"));
};

// POST /panel/devices/:id/enable: switch the device back on
export const enableDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req);
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
  return res.redirect(303, withNotice(returnPath(req, device), "enabled"));
};

// POST /panel/devices/:id/rotate: new HMAC key, old one dies at once (not audited: no AuditAction yet)
export const rotateDeviceKey = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req);
  if (!device) return renderNotFound(res);
  if (device.isRevoked)
    return res.redirect(
      303,
      `/panel/devices/${device.id}?notice=rotate-revoked`,
    );

  const hmacSecret = generateHmacSecret();
  await device.update({ hmacSecret });
  disconnectDevice(device.deviceId, "key rotated");

  return renderDevice(req, res, device, {
    newSecret: hmacSecret,
    secretReason: "rotated",
  });
};

// POST /panel/devices/:id/delete: needs the device password, the same rule as the API
export const deleteDevice = async (req: AuthRequest, res: Response) => {
  const device = await findDevice(req);
  if (!device) return renderNotFound(res);

  const { devicePassword: password } = deleteDeviceBodySchema.parse(
    req.body ?? {},
  );
  const valid =
    password.length > 0 &&
    (await bcrypt.compare(password, device.devicePasswordHash));

  if (!valid) {
    res.status(403);
    return renderDevice(req, res, device, {
      deleteError: password
        ? "That password doesn't match this device."
        : "Enter the device password.",
    });
  }

  await device.destroy();
  disconnectDevice(device.deviceId, "deleted");
  await createAuditLog(req, {
    action: AuditAction.DEVICE_DELETED,
    resourceType: AuditResourceType.DEVICE,
    resourceId: device.id,
    metadata: { deviceName: device.deviceName },
  });

  return res.redirect(303, "/panel/devices?notice=deleted");
};
