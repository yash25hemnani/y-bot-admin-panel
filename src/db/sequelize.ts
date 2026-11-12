import { Sequelize } from "sequelize";
import { ENV } from "../config/env";

const DB = ENV.DB;

// Neon (DATABASE_URL) requires SSL; a local Postgres from the DB_* parts doesn't
export const sequelize =
  DB.URL !== undefined
    ? new Sequelize(DB.URL, {
        dialect: "postgres",
        logging: false, // change to console.log for debugging
        dialectOptions: { ssl: { require: true } },
      })
    : new Sequelize(DB.NAME, DB.USER, DB.PASS, {
        host: DB.HOST,
        port: DB.PORT,
        dialect: "postgres",
        logging: false, // change to console.log for debugging
      });
