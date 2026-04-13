import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    paperId: { type: String, required: true, index: true },
    reviewerId: { type: String, required: true, index: true },
    assignedBy: { type: String, required: true },
    dueDate: { type: String, default: "" },
    status: {
      type: String,
      enum: ["assigned", "submitted"],
      default: "assigned"
    },
    scores: {
      originality: { type: Number, default: null },
      quality: { type: Number, default: null },
      relevance: { type: Number, default: null }
    },
    recommendation: {
      type: String,
      enum: ["accept", "reject", "weak-accept", "weak-reject", ""],
      default: ""
    },
    comments: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

reviewSchema.index({ paperId: 1, reviewerId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
