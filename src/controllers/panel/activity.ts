import { Response } from "express";
import { AuditLog, User } from "../../db/models";
import { activityQuerySchema } from "../../schemas/panel.schema";
import { ActivityFilter } from "../../types/activity.types";
import { AuthRequest } from "../../types/api.types";
import { getPaginationParams } from "../../utils/pagination";
import {
  describeLogs,
  groupByDay,
  isAdmin,
  ownedBy,
  renderPage,
  toPager,
} from "../../helpers/panel.helpers";

// Filter chips, like the history screen in the mobile app
const ACTIVITY_FILTERS: readonly ActivityFilter[] = [
  { key: "all", label: "All" },
  { key: "auth", label: "Sign-ins" },
  { key: "device", label: "Devices" },
  { key: "user", label: "Accounts" },
];

// GET /panel/activity: the audit log grouped by day, with type filter and pages
export const renderActivity = async (req: AuthRequest, res: Response) => {
  const query = activityQuerySchema.parse(req.query);
  const { type } = query;
  const { page, limit, offset } = getPaginationParams({ page: query.page, limit: 25 });

  const where = { ...ownedBy(req), ...(type === "all" ? {} : { resourceType: type }) };

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: "user", attributes: ["username"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  renderPage(res, "activity", "Activity", "activity", {
    admin: isAdmin(req),
    filters: ACTIVITY_FILTERS,
    type,
    days: groupByDay(await describeLogs(req, rows)),
    pager: toPager(page, count, limit),
  });
};
