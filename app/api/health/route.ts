import { NextResponse } from "next/server";
import { appUrl, type AppKey } from "@/lib/apps";
import { portalSecret } from "@/lib/auth";
import { databaseUrl, q1 } from "@/lib/db";

export const dynamic = "force-dynamic";

/** For the hourly health check: is the portal set up, is its database answering, can it reach both apps? */
export async function GET() {
  const checks: Record<string, boolean> = { portalKey: !!portalSecret() };
  try {
    checks.database = !!databaseUrl() && (await q1<{ ok: number }>("SELECT 1 AS ok"))?.ok === 1;
  } catch {
    checks.database = false;
  }
  await Promise.all((["office", "leave"] as AppKey[]).map(async (k) => {
    const base = appUrl(k);
    try {
      checks[k] = !!base && (await fetch(`${base}/login`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })).ok;
    } catch {
      checks[k] = false;
    }
  }));
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
