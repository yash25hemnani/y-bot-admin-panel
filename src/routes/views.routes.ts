import { Router } from "express";
import { renderDashboard, renderLogin } from "../controllers/views.controller";

const router = Router();

router.get("/login", renderLogin);

router.get("/", renderDashboard);

export default router;
