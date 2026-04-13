import express from "express";
import {
  assignReviewer,
  getAssignedReviewsMe,
  getReviewsByPaper,
  submitReview
} from "./review.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/assign", protect, assignReviewer);
router.get("/assigned/me", protect, getAssignedReviewsMe);
router.post("/:id/submit", protect, submitReview);
router.get("/paper/:paperId", protect, getReviewsByPaper);

export default router;
