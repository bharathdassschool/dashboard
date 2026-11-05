import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { q } from "./db";

/**
 * Phone notifications (Web Push). Switched off unless VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in Vercel.
 * Sending runs after the page has answered and never breaks what the person was doing.
 */
export function pushEnabled() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

/** Who gets it: the Manager's or Admin's phones, or particular staff (by portal staff id, or by their leave-system login id). */
export type PushTarget = { role: "manager" | "admin" } | { staffIds: number[] } | { leaveUserIds: number[] };
export type PushMessage = { title: string; body: string; url: string };

export function sendPush(target: PushTarget, msg: PushMessage) {
  if (!pushEnabled()) return;
  after(async () => {
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:office@bharathdass.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
      const subs = "role" in target
        ? await q<{ id: number; endpoint: string; p256dh: string; auth: string }>("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE role = $1", [target.role])
        : "staffIds" in target
          ? await q<{ id: number; endpoint: string; p256dh: string; auth: string }>("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE staff_id = ANY($1::int[])", [target.staffIds])
          : await q<{ id: number; endpoint: string; p256dh: string; auth: string }>(
              `SELECT p.id, p.endpoint, p.p256dh, p.auth FROM push_subscriptions p JOIN staff_accounts s ON s.id = p.staff_id
               WHERE s.leave_user_id = ANY($1::int[])`,
              [target.leaveUserIds],
            );
      await Promise.all(subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 24 * 3600 });
        } catch (e) {
          // The phone turned notifications off or the app was removed: forget it.
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await q("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
          else console.error("push failed:", code, e instanceof Error ? e.message : e);
        }
      }));
    } catch (e) {
      console.error("push failed:", e instanceof Error ? e.message : e);
    }
  });
}
