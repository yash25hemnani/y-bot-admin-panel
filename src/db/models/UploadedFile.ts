import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class UploadedFile extends Model {
  declare id: string;
  declare filename: string;
  declare originalName: string;
  declare mimeType: string;
  declare size: number;
  declare path: string;
  declare uploadedBy: string | null;
}

UploadedFile.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uploadedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "uploaded_files",
  },
);