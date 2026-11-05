"use server";

import { revalidatePath } from "next/cache";
import { action } from "@/lib/action";
import { managerPost } from "@/lib/apps";
import { requireActor } from "@/lib/auth";

/** Manager: let the Admin see the full history in the office and leave apps for a few days (0 = back to one week). */
export const setAdminHistory = action(async (fd) => {
  await requireActor("manager");
  const days = Math.max(0, Math.min(31, Number(fd.get("days")) || 0));
  const [office, leave] = await Promise.all([
    managerPost("office", "/api/portal/admin-history", "admin-history", { days }),
    managerPost("leave", "/api/portal/admin-history", "admin-history", { days }),
  ]);
  revalidatePath("/");
  if (!office || !leave) throw new Error(`Couldn't reach the ${!office && !leave ? "office and leave apps" : !office ? "office app" : "leave app"} – try again.`);
  return days ? `Admin can see the full history for ${days} day${days > 1 ? "s" : ""}.` : "Admin is back to the last 7 days.";
});
