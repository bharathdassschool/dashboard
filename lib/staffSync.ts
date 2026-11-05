import "server-only";
import { leaveCall } from "./apps";
import { q } from "./db";

type LeaveStaff = { userId: number; username: string; name: string; designation: string; classes: string; subjects: string; email?: string };

/**
 * Brings every staff member with a leave login into the portal, with the classes and subjects they handle, so question
 * papers reach the right teachers without anyone typing a staff list. Classes and subjects the Manager edited on the
 * portal are kept; they are only filled in from the leave system when blank. Returns how many were synced (null if
 * the leave app couldn't be reached – the portal then works with what it already has).
 */
export async function syncStaffFromLeave(): Promise<number | null> {
  const list = await leaveCall<LeaveStaff[]>("/api/portal/staff", "staff-list");
  if (!list) return null;
  if (!list.length) return 0;
  // One statement for everyone (95+ staff), not one per person.
  const ok = await q(
    `INSERT INTO staff_accounts (name, username, password_hash, leave_user_id, designation, classes, subjects, email)
     SELECT n, u, '', id, d, c, s, e FROM unnest($1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[]) AS t(n, u, id, d, c, s, e)
     WHERE NOT EXISTS (SELECT 1 FROM staff_accounts x WHERE lower(x.username) = lower(t.u) AND x.leave_user_id IS DISTINCT FROM t.id)
     ON CONFLICT (leave_user_id) DO UPDATE SET
       name = EXCLUDED.name, username = EXCLUDED.username, designation = EXCLUDED.designation, email = EXCLUDED.email,
       classes = CASE WHEN staff_accounts.classes = '' THEN EXCLUDED.classes ELSE staff_accounts.classes END,
       subjects = CASE WHEN staff_accounts.subjects = '' THEN EXCLUDED.subjects ELSE staff_accounts.subjects END`,
    [list.map((x) => x.name), list.map((x) => x.username), list.map((x) => x.userId), list.map((x) => x.designation ?? ""),
      list.map((x) => x.classes ?? ""), list.map((x) => x.subjects ?? ""), list.map((x) => x.email ?? "")],
  ).then(() => true, (e) => (console.error("staff sync", e), false));
  if (!ok) return null;
  return list.length;
}
