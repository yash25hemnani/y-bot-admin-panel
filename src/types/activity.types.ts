import { AuditLog } from "../db/models";
import { AuditAction, AuditResourceType } from "../db/models/AuditLog";
import { ActivityType } from "../schemas/panel.schema";

// Input to createAuditLog (utils/audit.ts)
export interface AuditParams {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  metadata?: object;
  userId?: string;
}

// One audit entry as a sentence for the activity feed
export interface ActivityView {
  id: string;
  createdAt: Date;
  who: string;
  isSelf: boolean;
  text: string;
  kind: string;
  ip: string | null;
}

export interface ActivityFilter {
  key: ActivityType;
  label: string;
}

// Audit row loaded with its user (include: [{ model: User, as: "user" }])
export type AuditLogWithUser = AuditLog & { user?: { username: string } };

// What device actions store in AuditLog.metadata
export interface DeviceLogMetadata {
  deviceName?: string;
}
