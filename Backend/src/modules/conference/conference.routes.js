import express from "express";
import {
  createConference,
  getConferenceAnalytics,
  getAllConferences,
  getConferenceById,
  seedConferences
} from "./conference.controller.js";

import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, createConference);
router.post("/seed", seedConferences);
router.get("/", getAllConferences);
router.get("/:id/analytics", protect, getConferenceAnalytics);
router.get("/:id", getConferenceById);

export default router;
