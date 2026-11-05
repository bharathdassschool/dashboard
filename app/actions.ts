"use server";

import { revalidatePath } from "next/cache";
import { action } from "@/lib/action";
import { managerPost } from "@/lib/apps";
import { requireActor } from "@/lib/auth";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function toBothApps(body: unknown) {
  const [office, leave] = await Promise.all([
    managerPost("office", "/api/portal/admin-history", "admin-history", body),
    managerPost("leave", "/api/portal/admin-history", "admin-history", body),
  ]);
  revalidatePath("/");
  if (!office || !leave) throw new Error(`Couldn't reach the ${!office && !leave ? "office and leave apps" : !office ? "office app" : "leave app"} – try again.`);
}

/**
 * Manager: let Admin see older entries (payments, shop sales and stock, leave log) from a chosen date until a chosen
 * day, e.g. to reconcile something. Admin isn't told; after that day they see only the last week again.
 */
export const shareAdminHistory = action(async (fd) => {
  await requireActor("manager");
  const from = String(fd.get("from") ?? "");
  const until = String(fd.get("until") ?? "");
  if (!DATE.test(from) || !DATE.test(until)) throw new Error("Choose both dates.");
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  if (from > today) throw new Error("“Show entries from” can't be in the future.");
  if (until < today) throw new Error("“Until” must be today or later.");
  await toBothApps({ from, until });
  return "Shared.";
});

export const stopAdminHistory = action(async () => {
  await requireActor("manager");
  await toBothApps({ stop: true });
  return "Admin is back to the last 7 days.";
});
