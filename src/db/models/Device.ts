import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";
import { User } from "./User";

interface DeviceAttributes {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: string
  devicePasswordHash: string;
  hmacSecret: string;
  createdAt: Date;
  updatedAt: Date;
  isRevoked: boolean;
  revokedAt: Date;
}

interface CreationAttributes extends Optional<
  DeviceAttributes,
  "id" | "createdAt" | "revokedAt" | "updatedAt" | "isRevoked"
> {}

export class Device
  extends Model<DeviceAttributes, CreationAttributes>
  implements DeviceAttributes
{
  declare id: string;
  declare userId: string;
  declare deviceId: string;
  declare deviceName: string;
  declare deviceType: string;
  declare devicePasswordHash: string;
  declare hmacSecret: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare isRevoked: boolean;
  declare revokedAt: Date;

  declare user?: User;
}

Device.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    devicePasswordHash: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    deviceType: {
        type: DataTypes.ENUM("ESP32", "ARDUINO")
    },
    hmacSecret: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  { sequelize, tableName: "devices" },
);
