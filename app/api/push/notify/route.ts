import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { sendPush, type PushTarget } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * The leave app asks the portal to send a phone notification (new leave request → Manager; decision → that staff
 * member). Only with a one-minute pass signed with PORTAL_SECRET for the portal, purpose "notify".
 * Body: { to: "manager" | { leaveUserId }, title, body, url } – url is a portal path.
 */
export async function POST(req: Request) {
  const secret = process.env.PORTAL_SECRET;
  if (!secret || secret.length < 32) return new NextResponse("Not found", { status: 404 });
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "bd-portal", audience: "portal", algorithms: ["HS256"], maxTokenAge: "2m" });
    if (payload.purpose !== "notify") throw new Error("purpose");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { to?: unknown; title?: string; body?: string; url?: string };
  const target: PushTarget | null = b.to === "manager"
    ? { role: "manager" }
    : typeof b.to === "object" && b.to && Number.isInteger((b.to as { leaveUserId?: number }).leaveUserId)
      ? { leaveUserIds: [(b.to as { leaveUserId: number }).leaveUserId] }
      : null;
  const url = typeof b.url === "string" && b.url.startsWith("/") && !b.url.startsWith("//") ? b.url : "/";
  if (!target || !b.title) return new NextResponse("Bad request", { status: 400 });
  sendPush(target, { title: String(b.title).slice(0, 120), body: String(b.body ?? "").slice(0, 300), url });
  return NextResponse.json({ ok: true });
}
