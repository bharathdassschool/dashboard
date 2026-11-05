import "server-only";
import { SignJWT } from "jose";
import { portalSecret } from "./auth";

export type AppKey = "office" | "leave";

export const APPS: Record<AppKey, { name: string; env: string }> = {
  office: { name: "Office (fees, shops, staff tours)", env: "OFFICE_URL" },
  leave: { name: "Staff leave & payslips", env: "LEAVE_URL" },
};

export function isApp(k: string): k is AppKey {
  return k in APPS;
}

/** The app's web address from OFFICE_URL / LEAVE_URL, or null when not set yet. */
export function appUrl(k: AppKey) {
  const u = process.env[APPS[k].env]?.trim().replace(/\/+$/, "");
  return u && /^https?:\/\//.test(u) ? u : null;
}

/**
 * A one-minute signed pass for one app. "login" opens it as Manager/Admin, "summary" reads the Manager's figures;
 * for the leave app also "verify" (check a teacher's password), "staff-login" / "staff-data" (that teacher's own
 * pages and figures, by uid) and "staff-list" (who teaches what).
 */
export async function appToken(k: AppKey, role: "manager" | "admin" | "staff", purpose: string, extra: Record<string, unknown> = {}) {
  const key = portalSecret();
  if (!key) throw new Error("PORTAL_SECRET is not set.");
  return new SignJWT({ role, purpose, ...extra })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bd-portal")
    .setAudience(k)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(key);
}

export type Fetched<T> = { ok: true; data: T } | { ok: false; error: string };

/** Headline figures from an app (Manager only). Never throws: a broken app shows a message instead of the numbers. */
export async function fetchSummary<T>(k: AppKey): Promise<Fetched<T>> {
  const base = appUrl(k);
  if (!base) return { ok: false, error: `Not connected yet – set ${APPS[k].env} in Vercel.` };
  try {
    const res = await fetch(`${base}/api/portal/summary`, {
      headers: { Authorization: `Bearer ${await appToken(k, "manager", "summary")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return { ok: false, error: "This app hasn't been connected to the portal yet (PORTAL_SECRET missing there, or not redeployed)." };
    if (res.status === 401) return { ok: false, error: "The app refused the portal – PORTAL_SECRET must be the same in both projects." };
    if (!res.ok) return { ok: false, error: `The app answered with an error (${res.status}).` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "The app took too long to answer." : "Couldn't reach the app." };
  }
}

/** A call to the leave app on behalf of the portal (JSON in and out). Returns null when it can't be reached. */
export async function leaveCall<T>(path: string, purpose: string, opts: { body?: unknown; uid?: number } = {}): Promise<T | null> {
  const base = appUrl("leave");
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      method: opts.body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${await appToken("leave", "staff", purpose, opts.uid ? { uid: opts.uid } : {})}`,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** A signed POST from the portal to one app as the Manager (e.g. opening Admin's history). Returns ok or not. */
export async function managerPost(k: AppKey, path: string, purpose: string, body: unknown): Promise<boolean> {
  const base = appUrl(k);
  if (!base) return false;
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await appToken(k, "manager", purpose)}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** A signed GET from the portal to one app as the Manager; returns the JSON, or null when it can't be reached. */
export async function managerGet<T>(k: AppKey, path: string, purpose: string): Promise<T | null> {
  const base = appUrl(k);
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${await appToken(k, "manager", purpose)}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
