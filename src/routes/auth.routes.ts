import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleRefresh,
  handleSignup
} from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { loginSchema, signupSchema } from "../schemas/auth.schema";

const router = Router();

router.post("/login", validate(loginSchema), handleLogin);
router.post("/signup", validate(signupSchema), handleSignup);
router.get("/refresh", handleRefresh);
router.post("/logout", handleLogout)

export default router;