import Notification from "./notification.model.js";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const resolveRecipientEmail = ({ recipientId, meta }) => {
  const explicit = meta?.recipientEmail;
  if (isEmail(explicit)) return explicit;
  if (isEmail(recipientId)) return recipientId;
  if (isEmail(process.env.EMAIL_FALLBACK_TO)) return process.env.EMAIL_FALLBACK_TO;
  return null;
};

const sendViaResend = async ({ to, subject, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !to) return { sent: false, reason: "missing_email_config" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text
    })
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `resend_failed:${res.status}`, body };
  }
  return { sent: true };
};

export const createNotification = async ({ recipientId, type, title, message, meta = {} }) => {
  const saved = await Notification.create({
    recipientId: String(recipientId),
    type: String(type || "info"),
    title: String(title),
    message: String(message),
    meta
  });

  const to = resolveRecipientEmail({ recipientId, meta });
  const subject = meta?.emailSubject || title;
  const text = meta?.emailBody || message;
  const delivery = await sendViaResend({ to, subject, text });

  if (!delivery.sent) {
    saved.meta = { ...saved.meta, delivery };
    await saved.save();
  }

  return saved;
};
