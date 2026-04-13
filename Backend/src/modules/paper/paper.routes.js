import express from "express";
import {
  getAllPapers,
  getDecisionContext,
  getPaperTimeline,
  getUserPapers,
  submitCameraReady,
  submitDecision,
  submitPaper
} from "./paper.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", getAllPapers);
router.post("/", protect, submitPaper);
router.get("/me", protect, getUserPapers);
router.get("/:id/decision-context", protect, getDecisionContext);
router.get("/:id/timeline", protect, getPaperTimeline);
router.post("/:id/decision", protect, submitDecision);
router.post("/:id/camera-ready", protect, submitCameraReady);

export default router;