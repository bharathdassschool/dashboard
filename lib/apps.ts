import "server-only";
import { SignJWT } from "jose";
import { portalSecret } from "./auth";

export type AppKey = "office" | "leave" | "papers";

export const APPS: Record<AppKey, { name: string; env: string }> = {
  office: { name: "Office (fees, shops, staff tours)", env: "OFFICE_URL" },
  leave: { name: "Staff leave & payslips", env: "LEAVE_URL" },
  papers: { name: "Question papers", env: "PAPERS_URL" },
};

export function isApp(k: string): k is AppKey {
  return k in APPS;
}

/** The app's web address from OFFICE_URL / LEAVE_URL / PAPERS_URL, or null when not set yet. */
export function appUrl(k: AppKey) {
  const u = process.env[APPS[k].env]?.trim().replace(/\/+$/, "");
  return u && /^https?:\/\//.test(u) ? u : null;
}

/** A one-minute signed pass for one app: "login" opens it signed in, "summary" reads the Manager's figures. */
export async function appToken(k: AppKey, role: "manager" | "admin", purpose: "login" | "summary") {
  const key = portalSecret();
  if (!key) throw new Error("PORTAL_SECRET is not set.");
  return new SignJWT({ role, purpose })
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
