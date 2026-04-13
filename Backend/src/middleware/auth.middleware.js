import admin from "../config/firebase.js";

export const protect = async (req, res, next) => {
  try {
    if (!admin.apps.length) {
      const demoUser = req.headers["x-demo-user"];
      if (demoUser) {
        req.user = {
          uid: String(demoUser),
          role: String(req.headers["x-user-role"] || "author")
        };
        return next();
      }
      return res.status(503).json({ msg: "Auth service is not configured on server" });
    }
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ msg: "No token" });

    const decoded = await admin.auth().verifyIdToken(token);

    req.user = {
      ...decoded,
      role: String(req.headers["x-user-role"] || decoded.role || "author")
    };
    next();

  } catch (err) {
    res.status(401).json({ msg: "Unauthorized" });
  }
};