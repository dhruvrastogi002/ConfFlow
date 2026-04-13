import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    type: { type: String, default: "info" },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
