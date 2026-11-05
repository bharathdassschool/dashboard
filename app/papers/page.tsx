import Link from "next/link";
import { DecisionBadge, StatusBadge } from "@/components/PaperBadges";
import { DbMissing, Shell } from "@/components/Shell";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { countToReview, listMyPapers, listPapers, paperTitle } from "@/lib/papers";

export const dynamic = "force-dynamic";

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function PapersPage() {
  const session = await requireSession();
  if (!databaseUrl()) return <Shell session={session}><DbMissing /></Shell>;

  if (session.role === "staff") {
    if (!session.staffId) {
      return (
        <Shell session={session}>
          <Card><p className="text-sm">Question papers are sent to each teacher personally. Sign out and sign in with <strong>your own staff login</strong> to see the papers waiting for you.</p></Card>
        </Shell>
      );
    }
    const [rows, toReview] = await Promise.all([listMyPapers(session.staffId), countToReview(session.staffId)]);
    return (
      <Shell session={session} toReview={toReview}>
        <PageHeader title="Question papers for you to review" subtitle="Open a paper, mark each question OK or Needs change, then give your final decision." />
        <Card>
          {rows.length === 0 ? <Empty>Nothing to review right now.</Empty> : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Paper</th><th>Sent</th><th>Questions</th><th>Your review</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link className="btn-link" href={`/papers/${r.id}`}>{paperTitle(r)}</Link>{r.version > 1 && <span className="text-muted"> (version {r.version})</span>}</td>
                      <td className="whitespace-nowrap">{date(r.sent_at)}</td>
                      <td className="num">{r.questions}</td>
                      <td><DecisionBadge decision={r.my_decision} submitted={!!r.my_submitted_at} /></td>
                      <td>{r.status === "in_review" && !r.my_submitted_at
                        ? <Link className="btn-primary" href={`/papers/${r.id}`}>{r.my_saved_at ? "Continue review" : "Review"}</Link>
                        : <span className="text-sm text-muted">{r.status === "closed" ? "Closed" : "Submitted"}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Shell>
    );
  }

  const isManager = session.role === "manager";
  const rows = await listPapers({ includeDrafts: isManager });
  return (
    <Shell session={session}>
      <PageHeader
        title="Question papers"
        subtitle={isManager
          ? "Upload papers made in Claude, send them to the teachers who handle that class and subject, and see each teacher's decision."
          : "View and print question papers. Papers marked Final are ready to print."}
        actions={isManager ? <Link className="btn-primary" href="/papers/new">Upload a paper</Link> : undefined}
      />
      <Card>
        {rows.length === 0 ? <Empty>{isManager ? "No papers yet – upload the first one." : "No papers yet."}</Empty> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Paper</th><th>Class</th><th>Subject</th><th>Exam</th><th>Status</th>{isManager && <th>Reviews</th>}<th>Uploaded</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="btn-link" href={`/papers/${r.id}`}>{r.title || `${r.subject} ${r.exam}`.trim()}</Link>{r.version > 1 && <span className="text-muted"> v{r.version}</span>}</td>
                    <td>{r.class_code}</td><td>{r.subject}</td><td>{r.exam || "—"}</td>
                    <td><StatusBadge paper={r} /></td>
                    {isManager && (
                      <td className="whitespace-nowrap text-sm">
                        {r.status === "draft" ? "—" : <>
                          {r.submitted} of {r.reviewers} done
                          {r.submitted > 0 && <span className="text-muted"> · {r.approved}✓ {r.with_changes}✎ {r.disapproved}✗</span>}
                        </>}
                      </td>
                    )}
                    <td className="whitespace-nowrap">{date(r.created_at)}</td>
                    <td><Link className="btn" href={`/papers/${r.id}/print`}>Print</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isManager && rows.length > 0 && <p className="mt-3 text-xs text-muted">✓ approved · ✎ approved with changes · ✗ disapproved</p>}
      </Card>
    </Shell>
  );
}
