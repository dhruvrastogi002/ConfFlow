import mongoose from "mongoose";

const conferenceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  abbr: { type: String, default: "", trim: true },
  org: { type: String, default: "", trim: true },
  domain: { type: String, default: "General", trim: true },
  location: { type: String, default: "", trim: true },
  date: { type: String, default: "" },
  tracks: { type: [String], default: [] },
  createdBy: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("Conference", conferenceSchema);