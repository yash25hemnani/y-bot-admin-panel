import app from "./app";
import { ENV } from "./config/env";
import { initDB } from "./db";
import { logger } from "./utils/logger";
import { attachDeviceSocket } from "./ws/deviceSocket";

const startServer = async () => {
  await initDB();

  // Express 5 calls this callback on failure too (e.g. EADDRINUSE), so check the error
  const server = app.listen(ENV.PORT, (err?: Error) => {
    if (err) {
      logger.error(err, `Could not listen on port ${ENV.PORT}`);
      process.exit(1);
    }
    logger.info(`API running on http://localhost:${ENV.PORT}`);
  });

  attachDeviceSocket(server);
};

startServer();