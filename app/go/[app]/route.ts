import { NextResponse, type NextRequest } from "next/server";
import { appToken, appUrl, isApp } from "@/lib/apps";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** /go/office?to=/excursion/payments – opens that page of the app, already signed in with the portal role. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  const session = await currentSession();
  const role = session?.role;
  if (!role) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!isApp(app)) return new NextResponse("Not found", { status: 404 });
  const base = appUrl(app);
  if (!base) return NextResponse.redirect(new URL("/?missing=" + app, req.url), 303);
  const to = req.nextUrl.searchParams.get("to") ?? "/";
  const path = to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") ? to : "/";
  const url = new URL("/portal-login", base);
  if (role === "staff") {
    // A teacher signed in with their own leave login opens their own leave pages as themselves;
    // the shared "staff" login has no such account, so it goes to the leave app's own sign-in.
    if (app !== "leave") return NextResponse.redirect(new URL("/", req.url), 303);
    if (session?.leaveUserId) url.searchParams.set("token", await appToken(app, "staff", "staff-login", { uid: session.leaveUserId }));
    else url.searchParams.set("token", await appToken(app, "staff", "signout"));
  } else {
    url.searchParams.set("token", await appToken(app, role, "login"));
  }
  url.searchParams.set("to", path);
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
