import Link from "next/link";
import { logout } from "@/app/login/actions";
import { Letterhead, Motto } from "@/components/Letterhead";
import { InstallApp } from "@/components/InstallApp";
import { NavTabs } from "@/components/NavTabs";
import { ROLE_LABEL, type Session } from "@/lib/auth";

/** Page frame for every portal page: letterhead, the menu for this role, who is signed in, the motto. */
export function Shell({ session, children, toReview = 0 }: { session: Session; children: React.ReactNode; toReview?: number }) {
  const links = [
    { href: "/", label: "Home" },
    ...(session.role !== "staff" || session.staffId ? [{ href: "/papers", label: toReview ? `Question papers · ${toReview}` : "Question papers" }] : []),
    ...(session.role === "manager" ? [{ href: "/staff", label: "Staff" }] : []),
  ];
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 lg:px-8">
      <header className="mb-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/"><Letterhead /></Link>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>{session.staffId ? session.name : ROLE_LABEL[session.role]}</span>
            <span aria-hidden>·</span>
            <form action={logout}><button className="btn-link" type="submit">Sign out</button></form>
          </div>
        </div>
        <div className="rule mt-4" />
        {links.length > 1 && <NavTabs links={links} />}
      </header>
      <main><InstallApp />{children}</main>
      <Motto />
    </div>
  );
}

export function DbMissing() {
  return (
    <p className="text-sm text-muted">
      Question papers need a database: in Vercel open the portal project → <strong>Storage → Create Database → Neon</strong>, connect it, then redeploy.
    </p>
  );
}
