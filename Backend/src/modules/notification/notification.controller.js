import Notification from "./notification.model.js";
import { buildNotificationTemplate } from "./notification.templates.js";

export const getMyNotifications = async (req, res) => {
  try {
    const rows = await Notification.find({ recipientId: req.user.uid }).sort({ createdAt: -1 });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to fetch notifications", error: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const row = await Notification.findById(req.params.id);
    if (!row) return res.status(404).json({ msg: "Notification not found" });
    if (row.recipientId !== req.user.uid) {
      return res.status(403).json({ msg: "Not allowed to update this notification" });
    }
    row.read = true;
    await row.save();
    return res.json(row);
  } catch (err) {
    return res.status(400).json({ msg: "Failed to mark notification as read", error: err.message });
  }
};

export const templatePreview = async (req, res) => {
  try {
    const { type } = req.params;
    const payload = {
      paperTitle: req.query.paperTitle,
      status: req.query.status,
      decisionNote: req.query.decisionNote,
      dueDate: req.query.dueDate,
      authorId: req.query.authorId
    };
    const preview = buildNotificationTemplate(type, payload);
    return res.json({ type, ...preview });
  } catch (err) {
    return res.status(400).json({ msg: "Failed to generate template preview", error: err.message });
  }
};
