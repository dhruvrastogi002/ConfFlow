import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { getMyNotifications, markNotificationRead, templatePreview } from "./notification.controller.js";

const router = express.Router();

router.get("/me", protect, getMyNotifications);
router.patch("/:id/read", protect, markNotificationRead);
router.get("/template-preview/:type", protect, templatePreview);

export default router;
