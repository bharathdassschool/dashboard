import Link from "next/link";
import { ActionForm } from "@/components/forms";
import { DecisionBadge } from "@/components/PaperBadges";
import { Card, Field } from "@/components/ui";
import { DECISION_LABEL, getQuestionReviews, REASON_LABEL, type Paper, type Question, type Reviewer } from "@/lib/papers";
import { saveReview } from "../actions";

/** A teacher reviewing a paper: OK / Needs change (with what to change) for each question, then a final decision. */
export async function StaffReview({ paper, questions, me }: { paper: Paper; questions: Question[]; me: Reviewer }) {
  const mine = new Map((await getQuestionReviews(paper.id, me.staff_id)).map((r) => [r.question_id, r]));
  const locked = !!me.submitted_at || paper.status !== "in_review";
  let section = "";
  return (
    <div className="flex flex-col gap-6">
      {paper.note_to_reviewers && <Card title="Note from the Manager"><p className="whitespace-pre-wrap text-sm">{paper.note_to_reviewers}</p></Card>}
      {locked && (
        <Card>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Your decision:</span> <DecisionBadge decision={me.decision} submitted={!!me.submitted_at} />
            {me.reason && <span className="text-bad">{REASON_LABEL[me.reason]}</span>}
            <span className="text-muted">{paper.status !== "in_review" ? "This paper is closed." : "Sent to the Manager. Ask them if you need to change it."}</span>
          </div>
          {me.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{me.comment}</p>}
        </Card>
      )}
      <ActionForm action={saveReview} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={paper.id} />
        <fieldset disabled={locked} className="contents">
          <Card title={`Questions (${questions.length})`} actions={<Link className="btn" href={`/papers/${paper.id}/print`}>Printable copy</Link>}>
            {paper.instructions && <div className="mb-4 whitespace-pre-wrap text-sm"><span className="font-semibold">General instructions: </span>{paper.instructions}</div>}
            <ol className="flex flex-col gap-4">
              {questions.map((qn) => {
                const r = mine.get(qn.id);
                const heading = qn.section && qn.section !== section ? qn.section : null;
                section = qn.section;
                return (
                  <li key={qn.id} className="list-none">
                    {heading && <div className="mb-2 mt-2 font-semibold uppercase">{heading}</div>}
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                      <div className="flex gap-3">
                        <span className="w-8 shrink-0 font-semibold">{qn.label ? `${qn.label}.` : ""}</span>
                        <div className="min-w-0 flex-1 whitespace-pre-wrap">{qn.body}</div>
                        {qn.marks && <span className="shrink-0 text-sm font-medium">[{qn.marks}]</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2"><input type="radio" name={`verdict_${qn.id}`} value="ok" defaultChecked={r?.verdict === "ok"} /> <span className="text-good font-medium">OK</span></label>
                        <label className="flex items-center gap-2"><input type="radio" name={`verdict_${qn.id}`} value="change" defaultChecked={r?.verdict === "change"} /> <span className="text-warn font-medium">Needs change</span></label>
                      </div>
                      <Field label="What should change / comment" className="mt-2">
                        <textarea name={`comment_${qn.id}`} rows={2} defaultValue={r?.comment} placeholder="e.g. Option (c) is also correct – replace it with Aluminium foil." />
                      </Field>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="Your final decision">
            <div className="flex flex-col gap-3 text-sm">
              {(["approved", "approved_with_changes", "disapproved"] as const).map((d) => (
                <label key={d} className="flex items-start gap-2">
                  <input type="radio" name="decision" value={d} defaultChecked={me.decision === d} className="mt-1" />
                  <span>
                    <span className="font-medium">{DECISION_LABEL[d]}</span>
                    <span className="block text-muted">
                      {d === "approved" ? "The paper is good to go as it is." : d === "approved_with_changes" ? "Good to go once the changes I marked are made." : "Don't use this paper."}
                    </span>
                  </span>
                </label>
              ))}
              <div className="ml-6 flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium text-muted">If disapproving, why?</span>
                {(["too_many_changes", "fundamental"] as const).map((x) => (
                  <label key={x} className="flex items-center gap-2"><input type="radio" name="reason" value={x} defaultChecked={me.reason === x} /> {REASON_LABEL[x]}</label>
                ))}
              </div>
              <Field label="Final comment (required when disapproving)">
                <textarea name="overall_comment" rows={3} defaultValue={me.comment} placeholder="Anything else the Manager should know." />
              </Field>
            </div>
          </Card>

          {!locked && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" name="intent" value="submit" className="btn-primary">Submit final decision</button>
              <button type="submit" name="intent" value="save" className="btn">Save and finish later</button>
              <span className="text-sm text-muted">After you submit, only the Manager can reopen your review.</span>
            </div>
          )}
        </fieldset>
      </ActionForm>
    </div>
  );
}
