import app from "./app";
import { ENV } from "./config/env";
import { initDB } from "./db";
import { logger } from "./utils/logger";
import { attachDeviceSocket } from "./ws/deviceSocket";

const startServer = async () => {
  await initDB();

  const server = app.listen(ENV.PORT, () => {
    logger.info(`API running on http://localhost:${ENV.PORT}`);
  });

  attachDeviceSocket(server);
};

startServer();