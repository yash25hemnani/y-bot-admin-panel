import { Router } from "express";
import { renderActivity } from "../controllers/panel/activity";
import { panelLogin, panelLogout, renderLogin } from "../controllers/panel/auth";
import {
  deleteDevice,
  enableDevice,
  listDevices,
  registerDevice,
  renderNewDevice,
  revokeDevice,
  rotateDeviceKey,
  showDevice,
} from "../controllers/panel/devices";
import { renderOverview } from "../controllers/panel/overview";
import { renderNotFound } from "../helpers/panel.helpers";
import { loadPanelUser, requirePanelUser, sameOriginPost } from "../middleware/panel.middleware";

const router = Router();

router.use(loadPanelUser, sameOriginPost);

// Signed out
router.get("/login", renderLogin);
router.post("/login", panelLogin);

// Signed in from here on
router.use(requirePanelUser);

router.post("/logout", panelLogout);

router.get("/", renderOverview);

router.get("/devices", listDevices);
router.get("/devices/new", renderNewDevice);
router.post("/devices", registerDevice);
router.get("/devices/:id", showDevice);
router.post("/devices/:id/revoke", revokeDevice);
router.post("/devices/:id/enable", enableDevice);
router.post("/devices/:id/rotate", rotateDeviceKey);
router.post("/devices/:id/delete", deleteDevice);

router.get("/activity", renderActivity);

router.use((req, res) => renderNotFound(res));

export default router;
