import { sequelize } from "./sequelize";
import { logger } from "../utils/logger";

export async function initDB() {
  try {
    // Authenticate sequelize
    await sequelize.authenticate();
    logger.info("Database connected");
  
  } catch (error) {
    logger.error(error, "DB connection failed");
    process.exit(1);
  }
}