import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "path";
import authRoutes from "./routes/auth.routes";
import viewsRoutes from "./routes/views.routes";
import { pinoHttp } from "pino-http";
import { logger } from "./utils/logger";
import * as viewHelpers from "./helpers/view.helpers";

const app = express();

// Behind Render's proxy: use X-Forwarded-For for req.ip (audit logs) and the real protocol
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.h = viewHelpers; // formatting helpers for EJS views

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet());
app.use(cookieParser());
app.use("/assets", express.static(path.join(__dirname, "..", "public", "assets")));

// Cheap endpoint for Render's health check and the keep-alive pinger; above pino-http so pings aren't logged
app.get("/health", (_req, res) => {
  res.type("text").send("ok");
});

app.use(
  pinoHttp({
    logger,
  }),
);

app.use("/api/auth", authRoutes);
app.use("/panel", viewsRoutes);

export default app;
