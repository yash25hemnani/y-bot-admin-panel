import { Response } from "express";
import { AuditLog, Device, User } from "../../db/models";
import { overviewQuerySchema } from "../../schemas/panel.schema";
import { AuthRequest } from "../../types/api.types";
import { countDevices, noticeFor, toDeviceView } from "../../helpers/device.helpers";
import {
  describeLogs,
  groupByDay,
  isAdmin,
  ownedBy,
  renderPage,
} from "../../helpers/panel.helpers";

const DESK_LIMIT = 8; // device rows on Overview; the rest are on the Devices page
const STATUS_ORDER = { online: 0, offline: 1, revoked: 2 } as const;

// GET /panel: device counts, the top devices and recent activity
export const renderOverview = async (req: AuthRequest, res: Response) => {
  const admin = isAdmin(req);

  const [counts, devices, logs, accounts] = await Promise.all([
    countDevices(req),
    Device.findAll({
      where: ownedBy(req),
      attributes: ["id", "deviceId", "deviceName", "deviceType", "isRevoked", "revokedAt", "createdAt"],
      include: admin ? [{ model: User, as: "user", attributes: ["username"] }] : [],
      order: [["createdAt", "DESC"]],
      limit: 500,
    }),
    AuditLog.findAll({
      where: ownedBy(req),
      include: [{ model: User, as: "user", attributes: ["username"] }],
      order: [["createdAt", "DESC"]],
      limit: 8,
    }),
    admin ? User.count() : Promise.resolve(null),
  ]);

  const views = devices.map(toDeviceView);
  // Online first, then offline, then revoked; newest first within each group
  const ranked = [...views].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  renderPage(res, "overview", "Overview", "overview", {
    admin,
    counts,
    accounts,
    devices: ranked.slice(0, DESK_LIMIT),
    days: groupByDay(await describeLogs(req, logs)),
    notice: noticeFor(overviewQuerySchema.parse(req.query).notice),
  });
};
