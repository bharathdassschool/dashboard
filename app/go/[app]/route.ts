import { NextResponse, type NextRequest } from "next/server";
import { appToken, appUrl, isApp } from "@/lib/apps";
import { currentRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** /go/office?to=/excursion/payments – opens that page of the app, already signed in with the portal role. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  const role = await currentRole();
  if (!role) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!isApp(app)) return new NextResponse("Not found", { status: 404 });
  const base = appUrl(app);
  if (!base) return NextResponse.redirect(new URL("/?missing=" + app, req.url), 303);
  const to = req.nextUrl.searchParams.get("to") ?? "/";
  const path = to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") ? to : "/";
  // Staff don't get a shared login inside the apps: they sign in to the leave app with their own account.
  if (role === "staff") {
    if (app !== "leave") return NextResponse.redirect(new URL("/", req.url), 303);
    return NextResponse.redirect(base + path, 303);
  }
  const url = new URL("/portal-login", base);
  url.searchParams.set("token", await appToken(app, role, "login"));
  url.searchParams.set("to", path);
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
