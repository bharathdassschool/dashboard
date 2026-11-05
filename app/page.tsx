import { Card, PageHeader, Stat } from "@/components/ui";
import { appUrl, fetchSummary, type AppKey, type Fetched } from "@/lib/apps";
import { requireRole, ROLE_LABEL } from "@/lib/auth";
import { logout } from "./login/actions";

export const dynamic = "force-dynamic";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (n: number) => inr.format(Math.round(n || 0));

type Link = { app: AppKey; to: string; label: string; primary?: boolean };
const go = (l: Link) => `/go/${l.app}?to=${encodeURIComponent(l.to)}`;

export default async function Home({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const role = await requireRole();
  const { missing } = await searchParams;
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="font-semibold">Bharath Dass School</div>
          <div className="text-xs text-muted">School portal</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="badge badge-muted">{ROLE_LABEL[role]}</span>
          <form action={logout}><button className="btn-link" type="submit">Sign out</button></form>
        </div>
      </header>
      {missing && <p className="card mb-6 text-sm text-warn">That app isn&apos;t connected to the portal yet (its web address is missing in Vercel).</p>}
      {role === "manager" ? <ManagerHome /> : role === "admin" ? <AdminHome /> : <StaffHome />}
    </div>
  );
}

/* ---------------- Staff: apply for leave and see their balance ---------------- */

function StaffHome() {
  const leave = appUrl("leave");
  return (
    <>
      <PageHeader title="Welcome" subtitle="Apply for leave and check how much leave you have left." />
      <div className="grid gap-4 sm:grid-cols-2">
        <a className="card hover:opacity-90" href={go({ app: "leave", to: "/leave/apply", label: "" })}>
          <div className="text-lg font-semibold">🗓 Apply for leave</div>
          <p className="mt-1 text-sm text-muted">Shows your balance before and after the leave.</p>
        </a>
        <a className="card hover:opacity-90" href={go({ app: "leave", to: "/leave/my", label: "" })}>
          <div className="text-lg font-semibold">📊 My leave balance</div>
          <p className="mt-1 text-sm text-muted">Sick, casual and paid leave left, and requests waiting for approval.</p>
        </a>
      </div>
      <p className="mt-4 text-sm text-muted">
        The first time, the leave page asks you to sign in with <strong>your own staff login</strong> (not the shared one).
        {!leave && " The leave app isn't connected yet."}
      </p>
    </>
  );
}

/* ---------------- Admin: data entry everywhere, no figures ---------------- */

const ADMIN_GROUPS: { title: string; icon: string; links: Link[] }[] = [
  { title: "Excursion fees", icon: "🚌", links: [
    { app: "office", to: "/excursion/payments#add", label: "Record a payment", primary: true },
    { app: "office", to: "/excursion", label: "Class rosters" },
    { app: "office", to: "/excursion/payments", label: "Payment log" },
    { app: "office", to: "/excursion/schedule", label: "Fee schedule" },
    { app: "office", to: "/excursion/unmatched", label: "Unmatched payments" },
    { app: "office", to: "/excursion/trips", label: "Trip details & expenses" },
  ] },
  { title: "School shops", icon: "🛒", links: [
    { app: "office", to: "/", label: "Daily sales, stock & costs", primary: true },
  ] },
  { title: "Staff tours", icon: "🧳", links: [
    { app: "office", to: "/staff-tours", label: "Contributions & expenses", primary: true },
  ] },
  { title: "Staff leave", icon: "🗓", links: [
    { app: "leave", to: "/leave/apply", label: "Apply on behalf of staff", primary: true },
    { app: "leave", to: "/leave/log", label: "Leave log" },
    { app: "leave", to: "/leave/staff", label: "Staff list" },
  ] },
  { title: "Payslips", icon: "₹", links: [
    { app: "leave", to: "/payslips", label: "Upload payslips", primary: true },
  ] },
  { title: "Question papers", icon: "📝", links: [
    { app: "papers", to: "/", label: "Classes & subjects", primary: true },
    { app: "papers", to: "/papers", label: "Generated papers" },
  ] },
];

function AdminHome() {
  return (
    <>
      <PageHeader title="Welcome, Admin" subtitle="Pick what you want to enter. Each button opens the right page, already signed in." />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_GROUPS.map((g) => (
          <Card key={g.title} title={<><span aria-hidden>{g.icon}</span> {g.title}</>}>
            <div className="flex flex-wrap gap-2">
              {g.links.map((l) => <a key={l.label} href={go(l)} className={l.primary ? "btn-primary" : "btn"}>{l.label}</a>)}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ---------------- Manager: every figure, approvals, and full access ---------------- */

type OfficeSummary = {
  excursion: { due: number; collected: number; outstanding: number; unpaidStudents: number };
  trips: { income: number; expense: number; net: number };
  shops: { slug: string; name: string; todayRevenue: number; monthRevenue: number; monthNet: number; allTimeNet: number }[];
  staffTours: { name: string; collected: number; due: number }[];
};
type LeaveSummary = {
  waitingApprover1: number; waitingApprover2: number; staff: number; overLimit: string[];
  onLeaveToday: { name: string; type: string; status: string }[];
};
type PapersSummary = {
  subjects: number; papers: number; papersThisMonth: number;
  recent: { id: number; class_code: string; subject: string; exam: string; created_by: string; created_at: string }[];
};

function Problem({ r }: { r: Fetched<unknown> }) {
  return r.ok ? null : <p className="text-sm text-warn">{r.error}</p>;
}

async function ManagerHome() {
  const [office, leave, papers] = await Promise.all([
    fetchSummary<OfficeSummary>("office"), fetchSummary<LeaveSummary>("leave"), fetchSummary<PapersSummary>("papers"),
  ]);
  const o = office.ok ? office.data : null;
  const l = leave.ok ? leave.data : null;
  const p = papers.ok ? papers.data : null;
  const shopMonthNet = o ? o.shops.reduce((a, s) => a + s.monthNet, 0) : 0;
  const waiting = l ? l.waitingApprover1 + l.waitingApprover2 : 0;
  return (
    <>
      <PageHeader title="Welcome, Manager" subtitle="Everything at a glance. Click any section to open it with full access." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Excursion fees collected" value={o ? money(o.excursion.collected) : "—"} tone="good" hint={o ? `${money(o.excursion.outstanding)} outstanding` : undefined} />
        <Stat label="Trip net profit" value={o ? money(o.trips.net) : "—"} tone={o && o.trips.net < 0 ? "bad" : "good"} hint={o ? `${money(o.trips.income)} income − ${money(o.trips.expense)} expense` : undefined} />
        <Stat label="Shops net profit (this month)" value={o ? money(shopMonthNet) : "—"} tone={shopMonthNet < 0 ? "bad" : "good"} />
        <Stat label="Leave waiting for approval" value={l ? waiting : "—"} tone={waiting > 0 ? "warn" : undefined} hint={l ? `${l.onLeaveToday.length} on leave today` : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="🚌 Excursion fees" actions={<a className="btn-link" href={go({ app: "office", to: "/excursion", label: "" })}>Open →</a>}>
          <Problem r={office} />
          {o && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Fee due" value={money(o.excursion.due)} />
              <Stat label="Outstanding" value={money(o.excursion.outstanding)} tone={o.excursion.outstanding > 0 ? "bad" : undefined} />
              <Stat label="Collection" value={o.excursion.due ? `${Math.round((o.excursion.collected / o.excursion.due) * 100)}%` : "—"} hint={`${o.excursion.unpaidStudents} students not yet paid`} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn" href={go({ app: "office", to: "/excursion/trips", label: "" })}>Trip budgets</a>
            <a className="btn" href={go({ app: "office", to: "/excursion/payments", label: "" })}>Payment log</a>
            <a className="btn" href={go({ app: "office", to: "/excursion/years", label: "" })}>Past years</a>
          </div>
        </Card>

        <Card title="🗓 Staff leave" actions={<a className="btn-link" href={go({ app: "leave", to: "/leave", label: "" })}>Open →</a>}>
          <Problem r={leave} />
          {l && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Waiting – approver 1" value={l.waitingApprover1} tone={l.waitingApprover1 ? "warn" : undefined} />
                <Stat label="Waiting – approver 2" value={l.waitingApprover2} tone={l.waitingApprover2 ? "warn" : undefined} />
                <Stat label="Over the limit" value={l.overLimit.length} tone={l.overLimit.length ? "bad" : undefined} hint={`of ${l.staff} staff`} />
              </div>
              <div className="mt-4 text-sm">
                <div className="mb-1 font-medium">On leave today</div>
                {l.onLeaveToday.length === 0 ? <p className="text-muted">Nobody.</p> : (
                  <ul className="flex flex-col gap-1">
                    {l.onLeaveToday.map((a, i) => <li key={i} className="flex justify-between gap-2"><span>{a.name}</span><span className="text-muted">{a.type} · {a.status}</span></li>)}
                  </ul>
                )}
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary" href={go({ app: "leave", to: "/leave/approvals", label: "" })}>Approvals{l && waiting ? ` (${waiting})` : ""}</a>
            <a className="btn" href={go({ app: "leave", to: "/leave/year-end", label: "" })}>Year-end payout</a>
            <a className="btn" href={go({ app: "leave", to: "/payslips", label: "" })}>Payslips</a>
          </div>
        </Card>

        <Card title="🛒 School shops" actions={<a className="btn-link" href={go({ app: "office", to: "/", label: "" })}>Open →</a>}>
          <Problem r={office} />
          {o && (o.shops.length === 0 ? <p className="text-sm text-muted">No shops yet.</p> : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Shop</th><th className="num">Sales today</th><th className="num">Sales this month</th><th className="num">Net profit (month)</th><th className="num">Net profit (all time)</th></tr></thead>
                <tbody>
                  {o.shops.map((s) => (
                    <tr key={s.slug}>
                      <td><a className="btn-link" href={go({ app: "office", to: `/shops/${s.slug}`, label: "" })}>{s.name}</a></td>
                      <td className="num">{money(s.todayRevenue)}</td><td className="num">{money(s.monthRevenue)}</td>
                      <td className={`num ${s.monthNet < 0 ? "text-bad" : ""}`}>{money(s.monthNet)}</td>
                      <td className={`num ${s.allTimeNet < 0 ? "text-bad" : ""}`}>{money(s.allTimeNet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Card>

        <Card title="🧳 Staff tours" actions={<a className="btn-link" href={go({ app: "office", to: "/staff-tours", label: "" })}>Open →</a>}>
          <Problem r={office} />
          {o && (o.staffTours.length === 0 ? <p className="text-sm text-muted">No open staff tours.</p> : (
            <ul className="flex flex-col gap-2 text-sm">
              {o.staffTours.map((t, i) => <li key={i} className="flex justify-between gap-2"><span>{t.name}</span><span className="tabular-nums">{money(t.collected)} of {money(t.due)}</span></li>)}
            </ul>
          ))}
        </Card>

        <Card title="📝 Question papers" actions={<a className="btn-link" href={go({ app: "papers", to: "/", label: "" })}>Open →</a>}>
          <Problem r={papers} />
          {p && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Subjects" value={p.subjects} />
                <Stat label="Papers generated" value={p.papers} />
                <Stat label="This month" value={p.papersThisMonth} />
              </div>
              {p.recent.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1 text-sm">
                  {p.recent.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <a className="btn-link" href={go({ app: "papers", to: `/paper/${r.id}`, label: "" })}>{r.class_code} · {r.subject} · {r.exam}</a>
                      <span className="text-muted">{r.created_by}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        <Card title="⚙ Users & settings">
          <div className="flex flex-wrap gap-2">
            <a className="btn" href={go({ app: "office", to: "/admin/users", label: "" })}>Office users</a>
            <a className="btn" href={go({ app: "office", to: "/admin/import", label: "" })}>Office: import from Excel</a>
            <a className="btn" href={go({ app: "leave", to: "/admin/users", label: "" })}>Leave users</a>
            <a className="btn" href={go({ app: "leave", to: "/leave/rules", label: "" })}>Leave rules</a>
            <a className="btn" href={go({ app: "papers", to: "/admin/users", label: "" })}>Question-paper users</a>
          </div>
        </Card>
      </div>
    </>
  );
}

