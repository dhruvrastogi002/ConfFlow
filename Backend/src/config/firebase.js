import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const serviceKey = process.env.FIREBASE_SERVICE_KEY;

if (serviceKey && !admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(serviceKey);
    admin.initializeApp({
      credential: admin.credential.cert({
        ...serviceAccount,
        private_key: serviceAccount.private_key.replace(/\\n/g, "\n")
      })
    });
  } catch (err) {
    console.warn("Firebase admin init skipped:", err.message);
  }
} else if (!serviceKey) {
  console.warn("FIREBASE_SERVICE_KEY not set; protected routes will be unavailable.");
}

export default admin;