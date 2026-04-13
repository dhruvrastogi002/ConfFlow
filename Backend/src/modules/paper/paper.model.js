import mongoose from "mongoose";

const paperSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  authorId: { type: String, required: true },
  confId: { type: String, required: true },
  track: { type: String, default: "General", trim: true },
  abstract: { type: String, default: "", trim: true },
  keywords: { type: String, default: "", trim: true },
  coAuthors: { type: String, default: "", trim: true },
  pdfUrl: { type: String, default: "", trim: true },
  status: {
    type: String,
    enum: ["submitted", "review", "accepted", "rejected", "camera"],
    default: "submitted"
  },
  aiScore: { type: Number, default: null },
  decisionNote: { type: String, default: "", trim: true },
  decisionBy: { type: String, default: "" },
  decisionAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Paper", paperSchema);