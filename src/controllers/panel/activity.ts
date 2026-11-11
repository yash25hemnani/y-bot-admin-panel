import { Response } from "express";
import { AuditLog, User } from "../../db/models";
import { AuthRequest } from "../../types/api";
import { getPaginationParams } from "../../utils/pagination";
import { groupByDay } from "../../utils/view-helpers";
import { describeLogs, isAdmin, ownedBy, renderPage } from "./shared";

// Filter chips, like the history screen in the mobile app
export const ACTIVITY_FILTERS = [
  { key: "all", label: "All" },
  { key: "auth", label: "Sign-ins" },
  { key: "device", label: "Devices" },
  { key: "user", label: "Accounts" },
] as const;

type FilterKey = (typeof ACTIVITY_FILTERS)[number]["key"];

export const renderActivity = async (req: AuthRequest, res: Response) => {
  const requested = String(req.query.type ?? "all");
  const type: FilterKey = ACTIVITY_FILTERS.some((f) => f.key === requested) ? (requested as FilterKey) : "all";
  const { page, limit, offset } = getPaginationParams({ page: req.query.page, limit: 25 });

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
    pager: { page, totalPages: Math.max(1, Math.ceil(count / limit)), total: count },
  });
};
