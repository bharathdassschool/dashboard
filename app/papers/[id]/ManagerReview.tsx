import Link from "next/link";
import { ActionForm, ButtonForm, Submit } from "@/components/forms";
import { DecisionBadge } from "@/components/PaperBadges";
import { PaperSheet } from "@/components/PaperSheet";
import { Card, Stat } from "@/components/ui";
import {
  getQuestionReviews, getReviewers, getStaffAccounts, REASON_LABEL, type Paper, type Question,
} from "@/lib/papers";
import { addReviewers, closePaper, makeRevision, removeReviewer, reopenPaper, reopenReview } from "../actions";

const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

/** Manager, after sending: every teacher's decision and their notes on each question; finish or revise the paper. */
export async function ManagerReview({ paper, questions }: { paper: Paper; questions: Question[] }) {
  const [reviewers, reviews, staff] = await Promise.all([getReviewers(paper.id), getQuestionReviews(paper.id), getStaffAccounts({ activeOnly: true })]);
  const names = new Map(reviewers.map((r) => [r.staff_id, r.name]));
  // Only submitted reviews count; drafts are the teacher's work in progress.
  const submitted = new Set(reviewers.filter((r) => r.submitted_at).map((r) => r.staff_id));
  const byQuestion = new Map<number, typeof reviews>();
  for (const r of reviews) if (submitted.has(r.staff_id)) byQuestion.set(r.question_id, [...(byQuestion.get(r.question_id) ?? []), r]);
  const done = reviewers.filter((r) => r.submitted_at);
  const count = (d: string) => done.filter((r) => r.decision === d).length;
  const flagged = questions.filter((qn) => (byQuestion.get(qn.id) ?? []).some((r) => r.verdict === "change")).length;
  const notYet = staff.filter((s) => !names.has(s.id));
  const open = paper.status === "in_review";
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Reviews in" value={`${done.length} of ${reviewers.length}`} />
        <Stat label="Approved" value={count("approved")} tone={count("approved") ? "good" : undefined} />
        <Stat label="Approved with changes" value={count("approved_with_changes")} tone={count("approved_with_changes") ? "warn" : undefined} />
        <Stat label="Disapproved" value={count("disapproved")} tone={count("disapproved") ? "bad" : undefined} />
        <Stat label="Questions flagged" value={`${flagged} of ${questions.length}`} tone={flagged ? "warn" : undefined} />
      </div>

      <Card title="Reviewers">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Teacher</th><th>Decision</th><th>Final comment</th><th>When</th><th></th></tr></thead>
            <tbody>
              {reviewers.map((r) => (
                <tr key={r.staff_id}>
                  <td className="font-medium">{r.name}</td>
                  <td>
                    <DecisionBadge decision={r.decision} submitted={!!r.submitted_at} />
                    {r.submitted_at && r.reason && <div className="mt-1 text-xs text-bad">{REASON_LABEL[r.reason]}</div>}
                  </td>
                  <td className="max-w-md whitespace-pre-wrap text-sm">{r.submitted_at ? r.comment || <span className="text-muted">—</span> : <span className="text-muted">Not submitted yet</span>}</td>
                  <td className="whitespace-nowrap text-sm text-muted">{when(r.submitted_at ?? r.saved_at)}</td>
                  <td className="whitespace-nowrap">
                    {open && r.submitted_at && <ButtonForm action={reopenReview} fields={{ id: paper.id, staff_id: r.staff_id }} label="Let them change it" className="btn-link" />}
                    {open && !r.submitted_at && <ButtonForm action={removeReviewer} fields={{ id: paper.id, staff_id: r.staff_id }} label="Remove" confirm={`Remove ${r.name} from this paper?`} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {open && notYet.length > 0 && (
          <details className="mt-3">
            <summary className="btn-link cursor-pointer">+ Add reviewers</summary>
            <ActionForm action={addReviewers} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="id" value={paper.id} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {notYet.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="reviewer" value={s.id} /> {s.name} <span className="text-muted">· {s.subjects}</span></label>
                ))}
              </div>
              <div><Submit className="btn">Add</Submit></div>
            </ActionForm>
          </details>
        )}
      </Card>

      <Card title="Questions with the teachers' notes" actions={<Link className="btn" href={`/papers/${paper.id}/print`}>Print</Link>}>
        <PaperSheet paper={paper} questions={questions}>
          {(qn) => {
            const rs = byQuestion.get(qn.id) ?? [];
            if (!rs.length) return null;
            return (
              <ul className="ml-11 mt-2 flex flex-col gap-1 text-sm">
                {rs.map((r) => (
                  <li key={r.staff_id} className={`rounded-md px-2 py-1 ${r.verdict === "change" ? "badge-warn" : ""}`}>
                    <span className="font-medium">{names.get(r.staff_id)}:</span>{" "}
                    {r.verdict === "ok" ? <span className="text-good">OK</span> : <span>Needs change</span>}
                    {r.comment && <span className="whitespace-pre-wrap"> – {r.comment}</span>}
                  </li>
                ))}
              </ul>
            );
          }}
        </PaperSheet>
      </Card>

      <Card title="Finish">
        {open ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <ButtonForm action={closePaper} fields={{ id: paper.id, outcome: "final" }} label="✓ Mark final – ready to print" className="btn-primary"
                confirm={done.length < reviewers.length ? "Not everyone has submitted their review yet. Mark final anyway?" : undefined} />
              <span className="text-muted">Admin sees it as final and prints it.</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonForm action={makeRevision} fields={{ id: paper.id }} label="✎ Make a revised version" className="btn"
                confirm="Start version 2 as a draft with the same questions to edit? This version will be closed." />
              <span className="text-muted">Copies the questions into a new draft so you can apply the changes (or paste Claude&apos;s corrected paper) and send it again.</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonForm action={closePaper} fields={{ id: paper.id, outcome: "rejected" }} label="✗ Reject this paper" confirm="Reject this paper?" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Closed {when(paper.closed_at)}.</span>
            {paper.outcome !== "revised" && <ButtonForm action={reopenPaper} fields={{ id: paper.id }} label="Reopen for review" className="btn" />}
            {paper.outcome !== "revised" && <ButtonForm action={makeRevision} fields={{ id: paper.id }} label="Make a revised version" className="btn" />}
          </div>
        )}
      </Card>
    </div>
  );
}
