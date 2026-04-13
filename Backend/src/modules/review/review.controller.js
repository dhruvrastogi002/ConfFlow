import Review from "./review.model.js";
import Paper from "../paper/paper.model.js";
import { buildNotificationTemplate } from "../notification/notification.templates.js";
import { logActivity } from "../activity/activity.service.js";
import { createNotification } from "../notification/notification.service.js";

export const assignReviewer = async (req, res) => {
  try {
    if (req.user?.role !== "chair") {
      return res.status(403).json({ msg: "Only chair users can assign reviewers" });
    }

    const { paperId, reviewerId, dueDate = "" } = req.body || {};
    if (!paperId || !String(paperId).trim()) {
      return res.status(400).json({ msg: "paperId is required" });
    }
    if (!reviewerId || !String(reviewerId).trim()) {
      return res.status(400).json({ msg: "reviewerId is required" });
    }

    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ msg: "Paper not found" });
    }

    const review = await Review.create({
      paperId: String(paperId),
      reviewerId: String(reviewerId),
      assignedBy: req.user.uid,
      dueDate
    });

    if (paper.status === "submitted") {
      paper.status = "review";
      await paper.save();
    }

    const tpl = buildNotificationTemplate("review-assigned", { paperTitle: paper.title, dueDate });
    await createNotification({
      recipientId: String(reviewerId),
      type: "review-assigned",
      title: tpl.title,
      message: tpl.message,
      meta: { paperId: String(paper._id), dueDate, emailSubject: tpl.emailSubject, emailBody: tpl.emailBody }
    });
    await logActivity({
      paperId: paper._id,
      actorId: req.user.uid,
      actorRole: req.user.role || "chair",
      eventType: "review-assigned",
      summary: `Reviewer ${reviewerId} assigned`,
      details: { reviewerId, dueDate }
    });

    return res.status(201).json(review);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ msg: "Reviewer already assigned to this paper" });
    }
    return res.status(400).json({ msg: "Failed to assign reviewer", error: err.message });
  }
};

export const getAssignedReviewsMe = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewerId: req.user.uid }).sort({ createdAt: -1 });
    const paperIds = [...new Set(reviews.map((r) => r.paperId))];
    const papers = await Paper.find({ _id: { $in: paperIds } });
    const paperMap = new Map(papers.map((p) => [String(p._id), p]));

    const enriched = reviews.map((r) => ({
      ...r.toObject(),
      paper: paperMap.get(r.paperId) || null
    }));
    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to fetch assigned reviews", error: err.message });
  }
};

export const submitReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ msg: "Review assignment not found" });
    }
    if (review.reviewerId !== req.user.uid) {
      return res.status(403).json({ msg: "You can only submit your own assigned review" });
    }

    const { scores = {}, recommendation = "", comments = "" } = req.body || {};
    const allowedScores = ["originality", "quality", "relevance"];
    for (const key of Object.keys(scores)) {
      if (!allowedScores.includes(key)) {
        return res.status(400).json({ msg: `Invalid score key: ${key}` });
      }
      const v = Number(scores[key]);
      if (!Number.isFinite(v) || v < 1 || v > 10) {
        return res.status(400).json({ msg: `Score ${key} must be between 1 and 10` });
      }
    }

    review.scores = {
      originality: scores.originality ?? review.scores.originality,
      quality: scores.quality ?? review.scores.quality,
      relevance: scores.relevance ?? review.scores.relevance
    };
    review.recommendation = recommendation || review.recommendation;
    review.comments = String(comments || "").trim();
    review.status = "submitted";

    await review.save();
    await logActivity({
      paperId: review.paperId,
      actorId: req.user.uid,
      actorRole: req.user.role || "reviewer",
      eventType: "review-submitted",
      summary: "Review submitted",
      details: { recommendation: review.recommendation, scores: review.scores }
    });
    return res.json(review);
  } catch (err) {
    return res.status(400).json({ msg: "Failed to submit review", error: err.message });
  }
};

export const getReviewsByPaper = async (req, res) => {
  try {
    if (req.user?.role !== "chair") {
      return res.status(403).json({ msg: "Only chair users can view all paper reviews" });
    }
    const reviews = await Review.find({ paperId: req.params.paperId }).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to fetch paper reviews", error: err.message });
  }
};
