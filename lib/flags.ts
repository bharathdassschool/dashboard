import "server-only";
import { managerGet, type AppKey } from "./apps";

/**
 * Entries the Manager flagged in the office and leave apps: "To fix" for Admin, or sent back to a staff member.
 * Each app keeps its own flags; the portal only lists them and passes on "Mark fixed".
 */
export type PortalFlag = {
  app: AppKey; id: number; target: "admin" | "staff"; targetUserId: number | null;
  label: string; note: string; href: string; createdBy: string; createdAt: string; doneAt: string | null; doneBy: string;
};

type OfficeFlag = { id: number; label: string; note: string; link: string; created_by: string; created_at: string; done_at: string | null; done_by: string };
type LeaveFlag = Omit<OfficeFlag, "link"> & { request_id: number; target: "admin" | "staff"; target_user_id: number | null };

const go = (app: AppKey, to: string) => `/go/${app}?to=${encodeURIComponent(to)}`;

/** All flags from both apps (open ones, and those done in the last week), newest first. */
export async function allFlags(): Promise<PortalFlag[]> {
  const [office, leave] = await Promise.all([
    managerGet<{ flags: OfficeFlag[] }>("office", "/api/portal/flags", "flags"),
    managerGet<{ flags: LeaveFlag[] }>("leave", "/api/portal/flags", "flags"),
  ]);
  const list: PortalFlag[] = [
    ...(office?.flags ?? []).map((f) => ({
      app: "office" as const, id: f.id, target: "admin" as const, targetUserId: null, label: f.label, note: f.note,
      href: go("office", f.link), createdBy: f.created_by, createdAt: f.created_at, doneAt: f.done_at, doneBy: f.done_by,
    })),
    ...(leave?.flags ?? []).map((f) => ({
      app: "leave" as const, id: f.id, target: f.target, targetUserId: f.target_user_id, label: f.label, note: f.note,
      href: go("leave", `/leave/requests/${f.request_id}`), createdBy: f.created_by, createdAt: f.created_at, doneAt: f.done_at, doneBy: f.done_by,
    })),
  ];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
