import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/PaperBadges";
import { PaperSheet } from "@/components/PaperSheet";
import { DbMissing, Shell } from "@/components/Shell";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { databaseUrl, q } from "@/lib/db";
import { countToReview, getPaper, getQuestions, getReviewers, paperTitle } from "@/lib/papers";
import { ManagerDraft } from "./ManagerDraft";
import { ManagerReview } from "./ManagerReview";
import { StaffReview } from "./StaffReview";

export const dynamic = "force-dynamic";

export default async function PaperPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; revision?: string; sent?: string; nosend?: string }> }) {
  const session = await requireSession();
  if (!databaseUrl()) return <Shell session={session}><DbMissing /></Shell>;
  const pid = Number((await params).id);
  const paper = Number.isInteger(pid) ? await getPaper(pid) : undefined;
  if (!paper) notFound();
  const sp = await searchParams;
  const questions = await getQuestions(pid);

  const header = (subtitle: React.ReactNode, actions?: React.ReactNode) => (
    <PageHeader
      title={<>{paperTitle(paper)}{paper.version > 1 && <span className="text-muted"> · version {paper.version}</span>}</>}
      subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge paper={paper} /> {subtitle}</span>}
      actions={actions}
    />
  );
  const fileLink = paper.has_file ? <a className="btn" href={`/papers/${pid}/file`} target="_blank" rel="noopener">Original file</a> : null;
  const older = paper.previous_id ? <Link className="btn-link" href={`/papers/${paper.previous_id}`}>See version {paper.version - 1} and its reviews</Link> : null;

  if (session.role === "manager") {
    const previousReviewers = paper.status === "draft" && paper.previous_id
      ? (await q<{ staff_id: number }>("SELECT staff_id FROM qp_reviewers WHERE paper_id = $1", [paper.previous_id])).map((r) => r.staff_id)
      : [];
    return (
      <Shell session={session}>
        {header(<>{paper.academic_year} {older}</>, fileLink)}
        {sp.sent && <p className="mb-6 text-sm text-good">Uploaded and sent – {questions.length} questions.</p>}
        {sp.new && <p className="mb-6 text-sm">{questions.length} questions read. Check them, then send.</p>}
        {sp.nosend && <p className="mb-6 text-sm text-warn">{questions.length ? "No teacher's subject and class match this paper yet – tick the reviewers below." : "No numbered questions were found – check the paper below."}</p>}
        {sp.revision && <p className="mb-6 text-sm">Version {paper.version} – same questions, ready to change and send again.</p>}
        {paper.status === "draft"
          ? <ManagerDraft paper={paper} questions={questions} previousReviewers={previousReviewers} />
          : <ManagerReview paper={paper} questions={questions} />}
      </Shell>
    );
  }

  if (session.role === "admin") {
    if (paper.status === "draft") notFound();
    return (
      <Shell session={session}>
        {header(<>{paper.academic_year}</>, <>{fileLink}<Link className="btn-primary" href={`/papers/${pid}/print`}>Print</Link></>)}
        {paper.outcome !== "final" && <p className="mb-6 text-sm text-warn">Not final yet.</p>}
        <Card><PaperSheet paper={paper} questions={questions} /></Card>
      </Shell>
    );
  }

  // Staff: only the reviewers of this paper, and only once it has been sent.
  const me = session.staffId ? (await getReviewers(pid)).find((r) => r.staff_id === session.staffId) : undefined;
  if (!me || paper.status === "draft") notFound();
  return (
    <Shell session={session} toReview={await countToReview(session.staffId!)}>
      {header(<>{paper.max_marks && `${paper.max_marks} marks`}{paper.duration && ` · ${paper.duration}`}</>, fileLink)}
      <StaffReview paper={paper} questions={questions} me={me} />
    </Shell>
  );
}
