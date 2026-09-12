import { Sequelize } from "sequelize";
import { ENV } from "../config/env";

// Create an instance of Sequelize
export const sequelize = new Sequelize(
  ENV.DB.NAME,
  ENV.DB.USER,
  ENV.DB.PASS,
  {
    host: ENV.DB.HOST,
    port: ENV.DB.PORT,
    dialect: "postgres",
    logging: false, // change to console.log for debugging
  }
);