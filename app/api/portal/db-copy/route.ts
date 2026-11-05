import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { copyToSingapore } from "@/lib/dbcopy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Copy this app's database into the new Singapore database (see lib/dbcopy.ts). Only with a one-minute pass signed
 * with PORTAL_SECRET for this app and purpose "db-copy"; reads the current database, writes only the new one.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.PORTAL_SECRET;
  if (!secret || secret.length < 32) return new NextResponse("Not found", { status: 404 });
  try {
    const { payload } = await jwtVerify(req.nextUrl.searchParams.get("token") ?? "", new TextEncoder().encode(secret), {
      issuer: "bd-portal", audience: "portal", algorithms: ["HS256"], maxTokenAge: "2m",
    });
    if (payload.purpose !== "db-copy") throw new Error("purpose");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const r = await copyToSingapore();
  return NextResponse.json(r, { status: r.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
