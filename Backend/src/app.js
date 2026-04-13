import express from "express";
import cors from "cors";

import conferenceRoutes from "./modules/conference/conference.routes.js";
import paperRoutes from "./modules/paper/paper.routes.js";
import reviewRoutes from "./modules/review/review.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*"
}));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/conferences", conferenceRoutes);
app.use("/api/papers", paperRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ msg: "Internal server error" });
});

export default app;