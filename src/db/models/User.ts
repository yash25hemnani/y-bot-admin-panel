// models/User.ts
import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

interface UserAttributes {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

interface UserCreationAttributes
  extends Optional<UserAttributes, "id" | "role"> {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: string;
  declare username: string;
  declare email: string;
  declare passwordHash: string;
  declare role: UserRole;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "user"),
      allowNull: false,
      defaultValue: "user",
    },
  },
  {
    sequelize,
    tableName: "users",
  }
);