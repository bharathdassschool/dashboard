"use server";

import { revalidatePath } from "next/cache";
import { action } from "@/lib/action";
import { isApp, managerPost } from "@/lib/apps";
import { requireActor } from "@/lib/auth";
import { allFlags } from "@/lib/flags";

/**
 * Admin marks a "To fix" entry fixed, or a staff member marks something sent back to them done. The app it belongs to
 * records it and tells the Manager.
 */
export const markFlagFixed = action(async (fd) => {
  const session = await requireActor();
  const app = String(fd.get("app") ?? "");
  const fid = Number(fd.get("id"));
  if (!isApp(app) || !Number.isInteger(fid)) throw new Error("Something went wrong – reload the page.");
  const f = (await allFlags()).find((x) => x.app === app && x.id === fid);
  if (!f || f.doneAt) throw new Error("Already marked done.");
  if (f.target === "admin") { if (session.role !== "admin") throw new Error("You do not have permission to do that."); }
  else if (!session.leaveUserId || f.targetUserId !== session.leaveUserId) throw new Error("You do not have permission to do that.");
  const ok = await managerPost(app, "/api/portal/flags", "flags", { id: fid, by: f.target === "admin" ? "Admin" : session.name });
  if (!ok) throw new Error("Couldn't reach the app – try again.");
  revalidatePath("/");
  return f.target === "admin" ? "Marked fixed – the Manager has been told." : "Marked done – the Manager has been told.";
});
