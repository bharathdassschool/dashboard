import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";

export type Role = "manager" | "admin" | "staff";
export const ROLES: Role[] = ["manager", "admin", "staff"];
export const ROLE_LABEL: Record<Role, string> = { manager: "Manager", admin: "Admin", staff: "Staff" };

const COOKIE = "bd_portal";
const MAX_AGE = 60 * 60 * 12; // 12 hours

/** Shared with the three apps: signs portal logins here and the links that open the apps. */
export function portalSecret() {
  const s = process.env.PORTAL_SECRET;
  return s && s.length >= 32 ? new TextEncoder().encode(s) : null;
}

/**
 * The three portal accounts. Username = the role; the password is PORTAL_PASSWORD_MANAGER / _ADMIN / _STAFF when set
 * in Vercel, otherwise the same as the username (temporary – set the variables to change them without touching code).
 */
function passwordFor(role: Role) {
  return process.env[`PORTAL_PASSWORD_${role.toUpperCase()}`] || role;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function checkLogin(username: string, password: string): Role | null {
  const role = ROLES.find((r) => r === username.trim().toLowerCase());
  // Compare in constant time even for an unknown username.
  const ok = timingSafeEqual(digest(password), digest(role ? passwordFor(role) : "\u0000no-such-user"));
  return role && ok ? role : null;
}

export async function startSession(role: Role) {
  const key = portalSecret();
  if (!key) throw new Error("PORTAL_SECRET is not set.");
  const token = await new SignJWT({ role }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentRole(): Promise<Role | null> {
  const key = portalSecret();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!key || !token) return null;
  try {
    const role = (await jwtVerify(token, key, { algorithms: ["HS256"] })).payload.role;
    return ROLES.includes(role as Role) ? (role as Role) : null;
  } catch {
    return null;
  }
}

export async function requireRole(): Promise<Role> {
  const role = await currentRole();
  if (!role) redirect("/login");
  return role;
}
