import "server-only";
import { after } from "next/server";

/**
 * Email through the school's Gmail. Switched off unless GMAIL_USER and GMAIL_APP_PASSWORD are set (Vercel → Settings →
 * Environment Variables; the app password comes from the Google account's Security → App passwords).
 * Sending never holds up or breaks what the person was doing: it runs after the page has answered, and failures are
 * only logged.
 */
export function mailEnabled() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/** The Manager's address(es) for notifications: NOTIFY_EMAIL (comma-separated), or the Gmail account itself. */
export function managerEmails() {
  return (process.env.NOTIFY_EMAIL || process.env.GMAIL_USER || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export type Mail = { to: string | string[]; subject: string; text: string; link?: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function html(m: Mail) {
  const body = esc(m.text).replace(/\n/g, "<br>");
  const button = m.link
    ? `<p style="margin:24px 0"><a href="${esc(m.link)}" style="background:#7a1d21;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Open</a></p>`
    : "";
  return `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2a2622">
  <div style="color:#7a1d21;font-weight:700;letter-spacing:.12em;font-size:20px">BHARATH DASS</div>
  <div style="font-size:10px;letter-spacing:.22em;font-weight:600;margin-top:4px">MATRICULATION HIGHER SECONDARY SCHOOL</div>
  <div style="border-top:2px solid #7a1d21;border-bottom:1px solid #a8843a;height:3px;margin:12px 0 20px"></div>
  <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${body}</div>${button}
  <div style="border-top:1px solid #a8843a;margin-top:28px;padding-top:10px;text-align:center;color:#7a1d21;font-style:italic;letter-spacing:.3em;font-size:11px">LEAD · KINDLY · LIGHT</div>
</div>`;
}

/** Queue an email to go out once the current request has finished. */
export function sendMail(m: Mail) {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (!mailEnabled() || to.length === 0) return;
  after(async () => {
    try {
      const nodemailer = await import("nodemailer");
      const t = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      await t.sendMail({
        from: `"Bharath Dass School" <${process.env.GMAIL_USER}>`,
        to,
        subject: m.subject,
        text: m.text + (m.link ? `\n\nOpen: ${m.link}` : ""),
        html: html(m),
      });
    } catch (e) {
      console.error("email failed:", m.subject, e instanceof Error ? e.message : e);
    }
  });
}
