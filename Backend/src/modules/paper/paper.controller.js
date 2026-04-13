import Paper from "./paper.model.js";
import Review from "../review/review.model.js";
import Activity from "../activity/activity.model.js";
import { logActivity } from "../activity/activity.service.js";
import { buildNotificationTemplate } from "../notification/notification.templates.js";
import { createNotification } from "../notification/notification.service.js";

export const submitPaper = async (req, res) => {
  try {
    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({ msg: "Paper title is required" });
    }
    if (!req.body?.confId || !String(req.body.confId).trim()) {
      return res.status(400).json({ msg: "Conference id is required" });
    }
    const paper = await Paper.create({
      ...req.body,
      authorId: req.user.uid
    });
    await logActivity({
      paperId: paper._id,
      actorId: req.user.uid,
      actorRole: req.user.role || "author",
      eventType: "paper-submitted",
      summary: "Paper submitted",
      details: { confId: paper.confId, track: paper.track }
    });
    res.status(201).json(paper);
  } catch (err) {
    res.status(400).json({ msg: "Failed to submit paper", error: err.message });
  }
};

export const getUserPapers = async (req, res) => {
  try {
    const papers = await Paper.find({ authorId: req.user.uid }).sort({ createdAt: -1 });
    res.json(papers);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch papers", error: err.message });
  }
};

export const getAllPapers = async (_req, res) => {
  try {
    const papers = await Paper.find().sort({ createdAt: -1 });
    res.json(papers);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch all papers", error: err.message });
  }
};

export const getDecisionContext = async (req, res) => {
  try {
    if (req.user?.role !== "chair") {
      return res.status(403).json({ msg: "Only chair users can view decision context" });
    }
    const paper = await Paper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({ msg: "Paper not found" });
    }
    const reviews = await Review.find({ paperId: String(paper._id), status: "submitted" }).sort({ createdAt: -1 });
    const averages = reviews.length
      ? {
          originality: Number((reviews.reduce((s, r) => s + (r.scores.originality || 0), 0) / reviews.length).toFixed(2)),
          quality: Number((reviews.reduce((s, r) => s + (r.scores.quality || 0), 0) / reviews.length).toFixed(2)),
          relevance: Number((reviews.reduce((s, r) => s + (r.scores.relevance || 0), 0) / reviews.length).toFixed(2))
        }
      : { originality: null, quality: null, relevance: null };

    return res.json({ paper, reviews, averages });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load decision context", error: err.message });
  }
};

export const submitDecision = async (req, res) => {
  try {
    if (req.user?.role !== "chair") {
      return res.status(403).json({ msg: "Only chair users can submit decisions" });
    }
    const { status, decisionNote = "" } = req.body || {};
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "Decision status must be accepted or rejected" });
    }
    const paper = await Paper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({ msg: "Paper not found" });
    }
    paper.status = status;
    paper.decisionNote = String(decisionNote).trim();
    paper.decisionBy = req.user.uid;
    paper.decisionAt = new Date();
    await paper.save();

    const tpl = buildNotificationTemplate("decision", {
      paperTitle: paper.title,
      status: paper.status,
      decisionNote: paper.decisionNote
    });
    await createNotification({
      recipientId: paper.authorId,
      type: "decision",
      title: tpl.title,
      message: tpl.message,
      meta: {
        paperId: String(paper._id),
        status: paper.status,
        decisionNote: paper.decisionNote,
        emailSubject: tpl.emailSubject,
        emailBody: tpl.emailBody
      }
    });
    await logActivity({
      paperId: paper._id,
      actorId: req.user.uid,
      actorRole: req.user.role || "chair",
      eventType: "decision-submitted",
      summary: `Decision: ${paper.status}`,
      details: { decisionNote: paper.decisionNote }
    });

    return res.json(paper);
  } catch (err) {
    return res.status(400).json({ msg: "Failed to submit decision", error: err.message });
  }
};

export const submitCameraReady = async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({ msg: "Paper not found" });
    }
    if (paper.authorId !== req.user.uid) {
      return res.status(403).json({ msg: "You can only submit camera-ready for your own paper" });
    }
    if (paper.status !== "accepted") {
      return res.status(400).json({ msg: "Only accepted papers can move to camera-ready" });
    }

    const { pdfUrl = "" } = req.body || {};
    if (pdfUrl) {
      paper.pdfUrl = String(pdfUrl).trim();
    }
    paper.status = "camera";
    await paper.save();

    const tpl = buildNotificationTemplate("camera-ready", {
      paperTitle: paper.title,
      authorId: paper.authorId
    });
    await createNotification({
      recipientId: paper.decisionBy || "chair",
      type: "camera-ready",
      title: tpl.title,
      message: tpl.message,
      meta: { paperId: String(paper._id), emailSubject: tpl.emailSubject, emailBody: tpl.emailBody }
    });
    await logActivity({
      paperId: paper._id,
      actorId: req.user.uid,
      actorRole: req.user.role || "author",
      eventType: "camera-ready-submitted",
      summary: "Camera-ready submitted",
      details: { pdfUrl: paper.pdfUrl }
    });

    return res.json(paper);
  } catch (err) {
    return res.status(400).json({ msg: "Failed to submit camera-ready", error: err.message });
  }
};

export const getPaperTimeline = async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({ msg: "Paper not found" });
    }
    const isAuthor = paper.authorId === req.user.uid;
    const isChair = req.user?.role === "chair";
    const hasReview = await Review.exists({ paperId: String(paper._id), reviewerId: req.user.uid });
    if (!isAuthor && !isChair && !hasReview) {
      return res.status(403).json({ msg: "You are not allowed to view this paper timeline" });
    }
    const activities = await Activity.find({ paperId: String(paper._id) }).sort({ createdAt: -1 });
    return res.json({ paperId: String(paper._id), activities });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to fetch paper timeline", error: err.message });
  }
};