// Device helpers for the panel controllers: live status, view models, counts and notices.

import { Op, WhereOptions } from "sequelize";
import { Device } from "../db/models";
import { AuthRequest } from "../types/api.types";
import {
  DeviceCounts,
  DeviceNotice,
  DeviceStatus,
  DeviceView,
} from "../types/device.types";
import { onlineDevices } from "../ws/deviceSocket";
import { ownedBy } from "./panel.helpers";

// Live status comes from the WebSocket server: a device is online while its socket is open.
export const onlineIds = () => [...onlineDevices.keys()];

function statusOf(
  device: Pick<Device, "deviceId" | "isRevoked">,
): DeviceStatus {
  if (device.isRevoked) return "revoked";
  return onlineDevices.has(device.deviceId) ? "online" : "offline";
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

export async function countDevices(
  req: AuthRequest,
  extra: WhereOptions = {},
): Promise<DeviceCounts> {
  const where = { ...ownedBy(req), ...extra };
  const ids = onlineIds();
  const [total, revoked, online] = await Promise.all([
    Device.count({ where }),
    Device.count({ where: { ...where, isRevoked: true } }),
    ids.length
      ? Device.count({
          where: { ...where, isRevoked: false, deviceId: { [Op.in]: ids } },
        })
      : Promise.resolve(0),
  ]);
  return { total, online, revoked, offline: total - online - revoked };
}

// Messages shown after a redirect, keyed by ?notice=
const NOTICES: Record<string, DeviceNotice> = {
  revoked: {
    tone: "warning",
    text: "Device switched off. It was disconnected and can't sign in until you switch it back on.",
  },
  enabled: {
    tone: "success",
    text: "Device switched on. It can sign in again with its current key.",
  },
  "rotate-revoked": {
    tone: "warning",
    text: "Switch this device on before giving it a new key.",
  },
  deleted: { tone: "success", text: "Device deleted." },
};

export const noticeFor = (key: string | undefined): DeviceNotice | null =>
  key && Object.prototype.hasOwnProperty.call(NOTICES, key)
    ? NOTICES[key]
    : null;
