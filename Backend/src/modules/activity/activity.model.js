import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    paperId: { type: String, required: true, index: true },
    actorId: { type: String, required: true },
    actorRole: { type: String, default: "user" },
    eventType: { type: String, required: true, index: true },
    summary: { type: String, required: true, trim: true },
    details: { type: Object, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model("Activity", activitySchema);
