import Link from "next/link";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, type Session } from "@/lib/auth";

/** Page frame for every portal page: school name, the menu for this role, who is signed in. */
export function Shell({ session, children, toReview = 0 }: { session: Session; children: React.ReactNode; toReview?: number }) {
  const links = [
    { href: "/", label: "Home" },
    ...(session.role !== "staff" || session.staffId ? [{ href: "/papers", label: toReview ? `Question papers (${toReview})` : "Question papers" }] : []),
    ...(session.role === "manager" ? [{ href: "/staff", label: "Staff logins" }] : []),
  ];
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/">
            <div className="font-semibold">Bharath Dass School</div>
            <div className="text-xs text-muted">School portal</div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {links.map((l) => <Link key={l.href} href={l.href} className="tab">{l.label}</Link>)}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>{session.staffId ? session.name : ""}</span>
          <span className="badge badge-muted">{ROLE_LABEL[session.role]}</span>
          <form action={logout}><button className="btn-link" type="submit">Sign out</button></form>
        </div>
      </header>
      {children}
    </div>
  );
}

export function DbMissing() {
  return (
    <div className="card text-sm">
      <p className="font-medium">Question papers need a database.</p>
      <p className="mt-1 text-muted">
        In Vercel, open the portal project → <strong>Storage → Create Database → Neon</strong> (free plan), connect it to the project,
        then <strong>Deployments → ⋯ → Redeploy</strong>.
      </p>
    </div>
  );
}
