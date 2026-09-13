import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export enum AuditAction {
  LOGIN = "login",
  LOGOUT = "logout",

  DEVICE_CREATED = "device_created",
  DEVICE_ENABLED = "device_enabled",
  DEVICE_REVOKED = "device_revoked",
  DEVICE_DELETED = "device_deleted",

  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
}

export enum AuditResourceType {
  USER = "user",
  DEVICE = "device",
  AUTH = "auth",
}

interface AuditLogAttributes {
  id: string;
  userId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  metadata: object | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditLogCreationAttributes extends Optional<
  AuditLogAttributes,
  "id" | "userId" | "resourceId" | "metadata" | "ipAddress" | "userAgent"
> {}

export class AuditLog
  extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes
{
  declare id: string;
  declare userId: string | null;
  declare action: AuditAction;
  declare resourceType: AuditResourceType;
  declare resourceId: string | null;
  declare metadata: object | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    action: {
      type: DataTypes.ENUM(...Object.values(AuditAction)),
      allowNull: false,
    },

    resourceType: {
      type: DataTypes.ENUM(...Object.values(AuditResourceType)),
      allowNull: false,
    },

    resourceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  { sequelize, tableName: "audit_logs" },
);
