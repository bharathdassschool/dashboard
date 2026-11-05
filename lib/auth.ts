import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { leaveCall } from "./apps";
import { databaseUrl, q1 } from "./db";

export type Role = "manager" | "admin" | "staff";
export const ROLES: Role[] = ["manager", "admin", "staff"];
export const ROLE_LABEL: Record<Role, string> = { manager: "Manager", admin: "Admin", staff: "Staff" };

/**
 * Who is signed in. The three shared logins (manager / admin / staff) have no staffId. A personal staff login,
 * made by the Manager on the Staff page, has role "staff" and its own staffId – it receives question papers to review.
 */
export type Session = { role: Role; staffId: number | null; name: string; leaveUserId: number | null };

const COOKIE = "bd_portal";
const MAX_AGE = 60 * 60 * 12; // 12 hours

/** Shared with the office and leave apps: signs portal logins here and the links that open the apps. */
export function portalSecret() {
  const s = process.env.PORTAL_SECRET;
  return s && s.length >= 32 ? new TextEncoder().encode(s) : null;
}

/**
 * The three shared accounts. Username = the role; the password is PORTAL_PASSWORD_MANAGER / _ADMIN / _STAFF when set
 * in Vercel, otherwise the same as the username (temporary – set the variables to change them without touching code).
 */
function passwordFor(role: Role) {
  return process.env[`PORTAL_PASSWORD_${role.toUpperCase()}`] || role;
}

const digest = (s: string) => createHash("sha256").update(s).digest();
const DUMMY_HASH = "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

export async function checkLogin(username: string, password: string): Promise<Session | null> {
  const u = username.trim().toLowerCase();
  const role = ROLES.find((r) => r === u);
  if (role) {
    // Constant-time comparison.
    return timingSafeEqual(digest(password), digest(passwordFor(role))) ? { role, staffId: null, name: ROLE_LABEL[role], leaveUserId: null } : null;
  }
  if (!databaseUrl()) return null;
  // 1. Someone the Manager added on the portal by hand (not in the leave system).
  const row = await q1<{ id: number; name: string; password_hash: string; active: boolean }>(
    "SELECT id, name, password_hash, active FROM staff_accounts WHERE lower(username) = $1 AND leave_user_id IS NULL AND password_hash <> ''",
    [u],
  );
  if (row) {
    const ok = await bcrypt.compare(password, row.password_hash);
    return row.active && ok ? { role: "staff", staffId: row.id, name: row.name, leaveUserId: null } : null;
  }
  // 2. Everyone else: their own staff leave login (checked by the leave app – one login for both).
  const v = await leaveCall<{ ok: boolean; userId: number; name: string; username: string }>("/api/portal/verify", "verify", { body: { username: u, password } });
  if (!v?.ok) {
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }
  const acct = await q1<{ id: number; name: string; active: boolean }>(
    `INSERT INTO staff_accounts (name, username, password_hash, leave_user_id) VALUES ($1, $2, '', $3)
     ON CONFLICT (leave_user_id) DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username
     RETURNING id, name, active`,
    [v.name, v.username, v.userId],
  ).catch(() => undefined);
  return acct?.active ? { role: "staff", staffId: acct.id, name: acct.name, leaveUserId: v.userId } : null;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function startSession(s: Session) {
  const key = portalSecret();
  if (!key) throw new Error("PORTAL_SECRET is not set.");
  const token = await new SignJWT({ role: s.role, sid: s.staffId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentSession(): Promise<Session | null> {
  const key = portalSecret();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!key || !token) return null;
  let role: unknown, sid: unknown;
  try {
    ({ role, sid } = (await jwtVerify(token, key, { algorithms: ["HS256"] })).payload);
  } catch {
    return null; // expired or tampered: signed out
  }
  if (!ROLES.includes(role as Role)) return null;
  if (typeof sid !== "number") return { role: role as Role, staffId: null, name: ROLE_LABEL[role as Role], leaveUserId: null };
  // A personal staff login stops working as soon as the Manager switches it off.
  const row = await q1<{ name: string; leave_user_id: number | null }>("SELECT name, leave_user_id FROM staff_accounts WHERE id = $1 AND active", [sid]);
  return row ? { role: "staff", staffId: sid, name: row.name, leaveUserId: row.leave_user_id } : null;
}

export async function currentRole(): Promise<Role | null> {
  return (await currentSession())?.role ?? null;
}

/** For pages: signed-out visitors go to /login; `roles` limits the page, everyone else goes home. */
export async function requireSession(...roles: Role[]): Promise<Session> {
  const s = await currentSession();
  if (!s) redirect("/login");
  if (roles.length && !roles.includes(s.role)) redirect("/");
  return s;
}

/** For server actions: throws instead of redirecting. */
export async function requireActor(...roles: Role[]): Promise<Session> {
  const s = await currentSession();
  if (!s || (roles.length && !roles.includes(s.role))) throw new Error("You do not have permission to do that.");
  return s;
}

export async function requireRole(): Promise<Role> {
  return (await requireSession()).role;
}
