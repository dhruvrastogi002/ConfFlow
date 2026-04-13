import Activity from "./activity.model.js";

export const logActivity = async ({ paperId, actorId, actorRole = "user", eventType, summary, details = {} }) => {
  if (!paperId || !actorId || !eventType || !summary) return;
  try {
    await Activity.create({
      paperId: String(paperId),
      actorId: String(actorId),
      actorRole: String(actorRole),
      eventType: String(eventType),
      summary: String(summary),
      details
    });
  } catch (_err) {
    // Keep business flow resilient even if audit log insert fails.
  }
};
