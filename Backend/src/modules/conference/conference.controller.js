import Conference from "./conference.model.js";
import Paper from "../paper/paper.model.js";
import Review from "../review/review.model.js";

const defaultConferences = [
  {
    title: "International Conference on Machine Learning 2026",
    abbr: "ICML 2026",
    org: "ML Research Society",
    domain: "AI",
    location: "Vienna, Austria",
    date: "2026-07-14",
    tracks: ["Deep Learning", "NLP", "Computer Vision"],
    createdBy: "system-seed"
  },
  {
    title: "Conference on Computer and Communications Security 2026",
    abbr: "CCS 2026",
    org: "ACM",
    domain: "Security",
    location: "Toronto, Canada",
    date: "2026-10-20",
    tracks: ["Network Security", "Cryptography", "Systems Security"],
    createdBy: "system-seed"
  }
];

export const createConference = async (req, res) => {
  try {
    if (req.user?.role !== "chair") {
      return res.status(403).json({ msg: "Only chair users can create conferences" });
    }
    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({ msg: "Conference title is required" });
    }
    if (req.body.tracks && !Array.isArray(req.body.tracks)) {
      return res.status(400).json({ msg: "Tracks must be an array of strings" });
    }
    const conf = await Conference.create({
      ...req.body,
      createdBy: req.user.uid
    });
    res.status(201).json(conf);
  } catch (err) {
    res.status(400).json({ msg: "Failed to create conference", error: err.message });
  }
};

export const seedConferences = async (_req, res) => {
  try {
    const count = await Conference.countDocuments();
    if (count > 0) {
      return res.json({ seeded: false, msg: "Conferences already exist" });
    }
    const docs = await Conference.insertMany(defaultConferences);
    return res.status(201).json({ seeded: true, count: docs.length });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to seed conferences", error: err.message });
  }
};

export const getAllConferences = async (req, res) => {
  try {
    const data = await Conference.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch conferences", error: err.message });
  }
};

export const getConferenceById = async (req, res) => {
  try {
    const conf = await Conference.findById(req.params.id);
    if (!conf) {
      return res.status(404).json({ msg: "Conference not found" });
    }
    res.json(conf);
  } catch (err) {
    res.status(400).json({ msg: "Invalid conference id", error: err.message });
  }
};

export const getConferenceAnalytics = async (req, res) => {
  try {
    if (req.user?.role !== "chair") {
      return res.status(403).json({ msg: "Only chair users can view conference analytics" });
    }
    const conf = await Conference.findById(req.params.id);
    if (!conf) return res.status(404).json({ msg: "Conference not found" });

    const papers = await Paper.find({ confId: String(conf._id) });
    const paperIds = papers.map((p) => String(p._id));
    const reviews = await Review.find({ paperId: { $in: paperIds } });
    const submittedReviews = reviews.filter((r) => r.status === "submitted");

    const statusCounts = {
      submitted: papers.filter((p) => p.status === "submitted").length,
      review: papers.filter((p) => p.status === "review").length,
      accepted: papers.filter((p) => p.status === "accepted").length,
      rejected: papers.filter((p) => p.status === "rejected").length,
      camera: papers.filter((p) => p.status === "camera").length
    };

    const avgReviewScore = submittedReviews.length
      ? Number(
          (
            submittedReviews.reduce((sum, r) => {
              const localAvg = ((r.scores?.originality || 0) + (r.scores?.quality || 0) + (r.scores?.relevance || 0)) / 3;
              return sum + localAvg;
            }, 0) / submittedReviews.length
          ).toFixed(2)
        )
      : null;

    return res.json({
      conference: conf,
      totalPapers: papers.length,
      totalReviews: reviews.length,
      submittedReviews: submittedReviews.length,
      statusCounts,
      acceptanceRate: papers.length ? Number(((statusCounts.accepted / papers.length) * 100).toFixed(2)) : 0,
      avgReviewScore
    });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load analytics", error: err.message });
  }
};