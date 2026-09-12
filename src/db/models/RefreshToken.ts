// models/RefreshToken.ts
import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";
import { User } from "./User";

interface RefreshTokenAttributes {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
}

interface CreationAttributes extends Optional<
  RefreshTokenAttributes,
  "id" | "isRevoked"
> {}

export class RefreshToken
  extends Model<RefreshTokenAttributes, CreationAttributes>
  implements RefreshTokenAttributes
{
  declare id: string;
  declare userId: string;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare isRevoked: boolean;

  declare user?: User;
}

RefreshToken.init(
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
        model: "users", // table name
        key: "id",
      },
      onDelete: "CASCADE",
    },
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { sequelize, tableName: "refresh_tokens" },
);