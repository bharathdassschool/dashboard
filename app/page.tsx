import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Card, PageHeader, Stat, Stats } from "@/components/ui";
import { appUrl, fetchSummary, leaveCall, type AppKey, type Fetched } from "@/lib/apps";
import { requireSession, type Session } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { countToReview, paperCounts } from "@/lib/papers";

export const dynamic = "force-dynamic";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (n: number) => inr.format(Math.round(n || 0));
const go = (app: AppKey, to: string) => `/go/${app}?to=${encodeURIComponent(to)}`;

type Row = { href: string; label: string; note?: React.ReactNode; external?: boolean };

/** A plain list of links – the portal's main building block. */
function Rows({ rows }: { rows: Row[] }) {
  return (
    <div>
      {rows.map((r) => {
        const inner = <><span>{r.label}</span><span className="text-muted">{r.note ?? "→"}</span></>;
        return r.external
          ? <a key={r.href + r.label} href={r.href} className="row-link">{inner}</a>
          : <Link key={r.href + r.label} href={r.href} className="row-link">{inner}</Link>;
      })}
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const session = await requireSession();
  const { missing } = await searchParams;
  const toReview = session.staffId && databaseUrl() ? await countToReview(session.staffId) : 0;
  return (
    <Shell session={session} toReview={toReview}>
      {missing && <p className="mb-6 text-sm text-warn">That app isn&apos;t connected yet – its address is missing in Vercel.</p>}
      {session.role === "manager" ? <ManagerHome /> : session.role === "admin" ? <AdminHome /> : <StaffHome session={session} toReview={toReview} />}
    </Shell>
  );
}

/* ---------------- Staff ---------------- */

type MyLeave = {
  name: string;
  balance: { sick: number; casual: number; paid: number };
  entitled: { sick: number; casual: number; paid: number };
  status: string;
  pendingCount: number;
  requests: { id: number; type: string; from: string; to: string; days: number; status: string }[];
  payslips: { id: number; month: string }[];
};

const day = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const monthName = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

async function StaffHome({ session, toReview }: { session: Session; toReview: number }) {
  // A teacher with their own login sees their own figures; the shared "staff" login can only open the leave app.
  const me = session.leaveUserId ? await leaveCall<MyLeave>("/api/portal/me", "staff-data", { uid: session.leaveUserId }) : null;
  const left = (k: keyof MyLeave["balance"]) => (me ? me.balance[k] : 0);
  return (
    <>
      <PageHeader title={session.staffId ? `Welcome, ${session.name}` : "Welcome"} />
      {me && (
        <Card className="mb-5" title="Leave left this year">
          <Stats>
            <Stat label="Sick" value={left("sick")} hint={`of ${me.entitled.sick}`} tone={left("sick") < 0 ? "bad" : undefined} />
            <Stat label="Casual" value={left("casual")} hint={`of ${me.entitled.casual}`} tone={left("casual") < 0 ? "bad" : undefined} />
            <Stat label="Paid" value={left("paid")} hint={`of ${me.entitled.paid}`} tone={left("paid") < 0 ? "bad" : undefined} />
            <Stat label="Waiting for approval" value={me.pendingCount} tone={me.pendingCount ? "warn" : undefined} />
          </Stats>
        </Card>
      )}
      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Leave">
          <Rows rows={[
            { href: go("leave", "/leave/apply"), label: "Apply for leave", external: true },
            { href: go("leave", "/leave/my"), label: "My leave & history", external: true },
            ...(me?.requests ?? []).slice(0, 3).map((r) => ({
              href: go("leave", "/leave/my"), external: true,
              label: `${r.type.replace(" Leave", "")} · ${day(r.from)}${r.to !== r.from ? ` – ${day(r.to)}` : ""}`,
              note: <span className={`badge ${r.status === "Approved" ? "badge-good" : r.status === "Rejected" ? "badge-bad" : "badge-warn"}`}>{r.status}</span>,
            })),
          ]} />
        </Card>
        <Card title="Payslips">
          {me
            ? me.payslips.length === 0
              ? <p className="text-sm text-muted">No payslips yet.</p>
              : <Rows rows={me.payslips.map((p) => ({ href: go("leave", `/api/payslips/${p.id}`), label: monthName(p.month), note: "View →", external: true }))} />
            : <Rows rows={[{ href: go("leave", "/payslips/my"), label: "My payslips", external: true }]} />}
        </Card>
        <Card title="Academics">
          {session.staffId
            ? <Rows rows={[{ href: "/papers", label: "Question papers to review", note: toReview ? <span className="badge badge-warn">{toReview} waiting</span> : "none waiting" }]} />
            : <p className="text-sm text-muted">Question papers for your subjects appear here when you sign in with your own login.</p>}
        </Card>
      </div>
      {!session.leaveUserId && (
        <p className="mt-4 text-sm text-muted">
          This is the shared Staff login, so it can&apos;t show anyone&apos;s own leave, payslips or papers. Sign out and sign in with
          {" "}<strong>your own leave login</strong> to see them here. Leave and payslip links ask for it.
          {!appUrl("leave") && " (The leave app isn't connected yet.)"}
        </p>
      )}
    </>
  );
}

/* ---------------- Admin: data entry, no figures ---------------- */

const ADMIN: { title: string; rows: Row[] }[] = [
  { title: "Excursion fees", rows: [
    { href: go("office", "/excursion/payments#add"), label: "Record a payment", external: true },
    { href: go("office", "/excursion"), label: "Class rosters", external: true },
    { href: go("office", "/excursion/schedule"), label: "Fee schedule", external: true },
    { href: go("office", "/excursion/trips"), label: "Trip details & expenses", external: true },
  ] },
  { title: "Shops & staff tours", rows: [
    { href: go("office", "/"), label: "Daily sales, stock & costs", external: true },
    { href: go("office", "/staff-tours"), label: "Staff tour contributions", external: true },
  ] },
  { title: "Staff", rows: [
    { href: go("leave", "/leave/apply"), label: "Apply leave on behalf of staff", external: true },
    { href: go("leave", "/leave/log"), label: "Leave log", external: true },
    { href: go("leave", "/payslips"), label: "Upload payslips", external: true },
  ] },
  { title: "Question papers", rows: [{ href: "/papers", label: "View & print papers" }] },
];

function AdminHome() {
  return (
    <>
      <PageHeader title="Welcome" subtitle="What would you like to enter?" />
      <div className="grid gap-5 md:grid-cols-2">
        {ADMIN.map((g) => <Card key={g.title} title={g.title}><Rows rows={g.rows} /></Card>)}
      </div>
    </>
  );
}

/* ---------------- Manager: everything ---------------- */

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

function Problem({ r }: { r: Fetched<unknown> }) {
  return r.ok ? null : <p className="text-sm text-warn">{r.error}</p>;
}

async function ManagerHome() {
  const [office, leave, papers] = await Promise.all([
    fetchSummary<OfficeSummary>("office"), fetchSummary<LeaveSummary>("leave"), databaseUrl() ? paperCounts() : Promise.resolve(null),
  ]);
  const o = office.ok ? office.data : null;
  const l = leave.ok ? leave.data : null;
  const p = papers;
  const shopNet = o ? o.shops.reduce((a, s) => a + s.monthNet, 0) : 0;
  const waiting = l ? l.waitingApprover1 + l.waitingApprover2 : 0;

  // Only what needs the Manager – everything else runs on its own.
  const attention: Row[] = [
    ...(waiting ? [{ href: go("leave", "/leave/approvals"), label: "Leave waiting for approval", note: <span className="badge badge-warn">{waiting}</span>, external: true }] : []),
    ...(p?.ready ? [{ href: "/papers", label: "Question papers with all reviews in – decide", note: <span className="badge badge-warn">{p.ready}</span> }] : []),
    ...(p?.drafts ? [{ href: "/papers", label: "Question paper drafts not sent yet", note: <span className="badge badge-muted">{p.drafts}</span> }] : []),
    ...(l?.overLimit.length ? [{ href: go("leave", "/leave/staff"), label: `Over the leave limit: ${l.overLimit.slice(0, 3).join(", ")}${l.overLimit.length > 3 ? " …" : ""}`, note: <span className="badge badge-bad">{l.overLimit.length}</span>, external: true }] : []),
  ];

  return (
    <>
      <PageHeader title="Overview" />

      <Card className="mb-5">
        <Stats>
          <Stat label="Fees collected" value={o ? money(o.excursion.collected) : "—"} hint={o ? `${money(o.excursion.outstanding)} outstanding` : undefined} />
          <Stat label="Trip net profit" value={o ? money(o.trips.net) : "—"} tone={o && o.trips.net < 0 ? "bad" : undefined} />
          <Stat label="Shops · this month" value={o ? money(shopNet) : "—"} tone={shopNet < 0 ? "bad" : undefined} hint="net profit" />
          <Stat label="Staff on leave today" value={l ? l.onLeaveToday.length : "—"} hint={l ? `${l.staff} staff in all` : undefined} />
        </Stats>
        <Problem r={office} />
        <Problem r={leave} />
      </Card>

      <Card title="Needs your attention" className="mb-5">
        {attention.length ? <Rows rows={attention} /> : <p className="text-sm text-muted">Nothing right now.</p>}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Office">
          <Rows rows={[
            { href: go("office", "/excursion"), label: "Excursion fees", note: o ? `${o.excursion.due ? Math.round((o.excursion.collected / o.excursion.due) * 100) : 0}% collected` : undefined, external: true },
            { href: go("office", "/excursion/trips"), label: "Trip budgets", note: o ? money(o.trips.net) : undefined, external: true },
            ...(o?.shops ?? []).map((s) => ({ href: go("office", `/shops/${s.slug}`), label: s.name, note: <span className={s.monthNet < 0 ? "text-bad" : ""}>{money(s.monthNet)} this month</span>, external: true })),
            ...(o?.staffTours ?? []).map((t) => ({ href: go("office", "/staff-tours"), label: t.name, note: `${money(t.collected)} of ${money(t.due)}`, external: true })),
          ]} />
        </Card>
        <Card title="Staff leave">
          {l && l.onLeaveToday.length > 0 && (
            <div className="mb-2 text-sm">
              {l.onLeaveToday.map((a, i) => <div key={i} className="flex justify-between py-1"><span>{a.name}</span><span className="text-muted">{a.type}</span></div>)}
            </div>
          )}
          <Rows rows={[
            { href: go("leave", "/leave"), label: "Leave overview", external: true },
            { href: go("leave", "/leave/year-end"), label: "Year-end payout", external: true },
            { href: go("leave", "/payslips"), label: "Payslips", external: true },
            { href: go("leave", "/leave/rules"), label: "Leave rules", external: true },
          ]} />
        </Card>
        <Card title="Question papers">
          <Rows rows={[
            { href: "/papers/new", label: "Upload a paper" },
            { href: "/papers", label: "All papers", note: p ? `${p.in_review} in review · ${p.final} final` : undefined },
          ]} />
        </Card>
        <Card title="Settings">
          <Rows rows={[
            { href: "/staff", label: "Staff & subjects", note: "who reviews which papers" },
            { href: go("leave", "/admin/users"), label: "Staff logins & passwords", note: "leave system", external: true },
            { href: go("office", "/admin/users"), label: "Office users", note: "who can enter fees & shops", external: true },
          ]} />
        </Card>
      </div>
    </>
  );
}
