import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../utils/upload";
import { deleteFile, getFile, uploadFile } from "../controllers/files.controller";

const router = Router();

router.post("/", authMiddleware(), upload.single("file"), uploadFile);
router.get("/:id", authMiddleware(), getFile);
router.delete("/:id", authMiddleware(), deleteFile);

export default router;