import Link from "next/link";
import { notFound } from "next/navigation";
import { PaperSheet } from "@/components/PaperSheet";
import { PrintButton } from "@/components/PrintButton";
import { requireSession } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { getPaper, getQuestions, OUTCOME_LABEL } from "@/lib/papers";

export const dynamic = "force-dynamic";

/** Clean printable copy of a paper (Manager, Admin, and the paper's reviewers). */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const pid = Number((await params).id);
  const paper = Number.isInteger(pid) ? await getPaper(pid) : undefined;
  if (!paper) notFound();
  const reviewer = session.staffId ? await q1("SELECT 1 FROM qp_reviewers WHERE paper_id=$1 AND staff_id=$2", [pid, session.staffId]) : undefined;
  const allowed = session.role === "manager" || (paper.status !== "draft" && (session.role === "admin" || !!reviewer));
  if (!allowed) notFound();
  const questions = await getQuestions(pid);
  const warn = paper.outcome === "final" ? null : paper.status === "draft" ? "Draft – not sent for review yet." : paper.status === "in_review" ? "Still in review – not final yet." : paper.outcome ? `${OUTCOME_LABEL[paper.outcome]}.` : null;
  return (
    <div className="mx-auto max-w-[800px] px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="btn" href={`/papers/${pid}`}>← Back</Link>
        <div className="flex flex-wrap gap-2">
          {paper.has_file && <a className="btn" href={`/papers/${pid}/file`} target="_blank" rel="noopener">Original file ({paper.file_name})</a>}
          <PrintButton />
        </div>
      </div>
      {warn && <p className="card mb-6 text-sm text-warn print:hidden">{warn}</p>}
      <div className="card print:border-0 print:p-0" style={{ background: "var(--surface)" }}>
        {questions.length ? <PaperSheet paper={paper} questions={questions} /> : <p className="text-sm text-muted">This paper has no questions typed in – use the original file.</p>}
      </div>
    </div>
  );
}
