import Link from "next/link";
import { ActionForm } from "@/components/forms";
import { DecisionBadge } from "@/components/PaperBadges";
import { Card, Field } from "@/components/ui";
import { getQuestionReviews, REASON_LABEL, type Paper, type Question, type Reviewer } from "@/lib/papers";
import { saveReview } from "../actions";

/** A teacher's review: every question is OK unless flagged; then Approve or Disapprove. */
export async function StaffReview({ paper, questions, me }: { paper: Paper; questions: Question[]; me: Reviewer }) {
  const mine = new Map((await getQuestionReviews(paper.id, me.staff_id)).map((r) => [r.question_id, r]));
  const locked = !!me.submitted_at || paper.status !== "in_review";
  let section = "";
  return (
    <div className="flex flex-col gap-5">
      {paper.note_to_reviewers && <p className="text-sm"><span className="eyebrow mr-2">Note</span>{paper.note_to_reviewers}</p>}
      {!locked && me.return_note && (
        <Card>
          <p className="text-sm" style={{ color: "var(--bad)" }}><strong>Sent back to you:</strong> {me.return_note}</p>
          <p className="mt-1 text-xs text-muted">Make the changes below and send your decision again.</p>
        </Card>
      )}
      {locked && (
        <Card>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <DecisionBadge decision={me.decision} submitted={!!me.submitted_at} />
            {me.reason && <span className="text-bad">{REASON_LABEL[me.reason]}</span>}
            <span className="text-muted">{paper.status !== "in_review" ? "This paper is closed." : "Sent. Ask the Manager if you need to change it."}</span>
          </div>
          {me.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{me.comment}</p>}
        </Card>
      )}
      {!locked && <p className="text-sm text-muted">Every question counts as OK. Tick <strong>Needs change</strong> only where something should change, and say what.</p>}
      <ActionForm action={saveReview} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={paper.id} />
        <fieldset disabled={locked} className="contents">
          <Card actions={<Link className="btn-link" href={`/papers/${paper.id}/print`}>Printable copy</Link>} title={`${questions.length} questions`}>
            <ol className="flex flex-col">
              {questions.map((qn) => {
                const r = mine.get(qn.id);
                const heading = qn.section && qn.section !== section ? qn.section : null;
                section = qn.section;
                return (
                  <li key={qn.id} className="list-none">
                    {heading && <div className="eyebrow mb-1 mt-5 first:mt-0">{heading}</div>}
                    <div className="review-q border-b py-3" style={{ borderColor: "var(--border)" }}>
                      <div className="flex gap-3">
                        <span className="w-7 shrink-0 font-semibold">{qn.label ? `${qn.label}.` : ""}</span>
                        <div className="min-w-0 flex-1 whitespace-pre-wrap">{qn.body}</div>
                        {qn.marks && <span className="shrink-0 text-sm text-muted">[{qn.marks}]</span>}
                      </div>
                      <label className="ml-10 mt-2 inline-flex items-center gap-2 text-sm text-warn">
                        <input type="checkbox" name={`verdict_${qn.id}`} value="change" defaultChecked={r?.verdict === "change"} className="flag" /> Needs change
                      </label>
                      <div className="flag-note ml-10 mt-2">
                        <textarea name={`comment_${qn.id}`} rows={2} defaultValue={r?.comment} placeholder="What should change?" className="input" />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {!locked && (
            <Card>
              <Field label="Comment for the Manager (optional; required to disapprove)">
                <textarea name="overall_comment" rows={2} defaultValue={me.comment} />
              </Field>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" name="intent" value="approve" className="btn-primary">Approve</button>
                <details className="relative">
                  <summary className="btn cursor-pointer list-none">Disapprove…</summary>
                  <div className="card absolute z-10 mt-2 flex w-72 flex-col gap-2 text-sm shadow-lg">
                    {(["too_many_changes", "fundamental"] as const).map((x) => (
                      <label key={x} className="flex items-center gap-2"><input type="radio" name="reason" value={x} defaultChecked={me.reason === x} /> {REASON_LABEL[x]}</label>
                    ))}
                    <button type="submit" name="intent" value="disapprove" className="btn mt-1" style={{ color: "var(--bad)" }}>Send disapproval</button>
                  </div>
                </details>
                <button type="submit" name="intent" value="save" className="btn-link">Save for later</button>
              </div>
              <p className="mt-3 text-xs text-muted">If you flagged any question, Approve is sent as “Approved with changes”.</p>
            </Card>
          )}
        </fieldset>
      </ActionForm>
    </div>
  );
}
