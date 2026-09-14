import { AuditAction, AuditLog, AuditResourceType } from "../db/models/AuditLog";
import { AuthRequest } from "../types/api";

interface AuditParams {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  metadata?: object;
  userId?: string;
}

export async function createAuditLog(
  req: AuthRequest,
  params: AuditParams,
) {
  await AuditLog.create({
    userId: params.userId ?? req.user?.id ?? null,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}