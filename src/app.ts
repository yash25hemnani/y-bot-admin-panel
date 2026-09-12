import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "path";
import authRoutes from "./routes/auth.routes";
import filesRoutes from "./routes/files.routes";
import viewsRoutes from "./routes/views.routes";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet());
app.use(cookieParser());
app.use("/assets", express.static(path.join(__dirname, "..", "public", "assets")));

app.use("/api/auth", authRoutes);
app.use("/api/files", filesRoutes);
app.use("/panel", viewsRoutes);

export default app;
