"use server";

import { requireActor } from "@/lib/auth";
import { q } from "@/lib/db";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/** This phone wants notifications for whoever is signed in on it. */
export async function savePushSubscription(sub: Sub) {
  const me = await requireActor();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("That didn't work – try again.");
  await q(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, role, staff_id) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, role = EXCLUDED.role, staff_id = EXCLUDED.staff_id`,
    [sub.endpoint.slice(0, 1000), sub.keys.p256dh.slice(0, 200), sub.keys.auth.slice(0, 100), me.role, me.staffId],
  );
}

export async function removePushSubscription(endpoint: string) {
  await requireActor();
  await q("DELETE FROM push_subscriptions WHERE endpoint = $1", [String(endpoint).slice(0, 1000)]);
}
