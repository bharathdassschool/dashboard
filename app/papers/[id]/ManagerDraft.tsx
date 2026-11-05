import Link from "next/link";
import { ActionForm, ButtonForm, Submit } from "@/components/forms";
import { PaperFields } from "@/components/PaperFields";
import { Card, Empty, Field } from "@/components/ui";
import { getStaffAccounts, matchesPaper, type Paper, type Question } from "@/lib/papers";
import { deletePaper, deleteQuestion, moveQuestion, replaceFile, rereadQuestions, savePaperDetails, saveQuestion, sendForReview } from "../actions";

/** Manager, before sending: check every question, fix details, choose reviewers. */
export async function ManagerDraft({ paper, questions, previousReviewers }: { paper: Paper; questions: Question[]; previousReviewers: number[] }) {
  const staff = await getStaffAccounts({ activeOnly: true });
  const pre = new Set(previousReviewers.length ? previousReviewers : staff.filter((s) => matchesPaper(s, paper)).map((s) => s.id));
  return (
    <div className="flex flex-col gap-6">
      <Card title={`Questions (${questions.length})`} actions={<Link className="btn" href={`/papers/${paper.id}/print`}>Preview / print</Link>}>
        <p className="mb-4 text-sm text-muted">Check that each question was read correctly. Edit, delete, move or add questions here – teachers review exactly this list.</p>
        {questions.length === 0 ? <Empty>No questions were read. Paste the text below, or add questions one by one.</Empty> : (
          <div className="flex flex-col gap-3">
            {questions.map((qn, i) => (
              <div key={qn.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <ActionForm action={saveQuestion} className="grid gap-2 sm:grid-cols-[5rem_1fr_5rem]">
                  <input type="hidden" name="id" value={qn.id} />
                  <input type="hidden" name="paper_id" value={paper.id} />
                  <Field label="No."><input name="label" defaultValue={qn.label} /></Field>
                  <Field label="Section"><input name="section" defaultValue={qn.section} /></Field>
                  <Field label="Marks"><input name="marks" defaultValue={qn.marks} /></Field>
                  <Field label="Question" className="sm:col-span-3"><textarea name="body" rows={Math.min(10, qn.body.split("\n").length + 1)} defaultValue={qn.body} /></Field>
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Submit className="btn">Save</Submit></div>
                </ActionForm>
                <div className="mt-2 flex flex-wrap gap-3">
                  {i > 0 && <ButtonForm action={moveQuestion} fields={{ id: qn.id, paper_id: paper.id, dir: "up" }} label="↑ Move up" className="btn-link" />}
                  {i < questions.length - 1 && <ButtonForm action={moveQuestion} fields={{ id: qn.id, paper_id: paper.id, dir: "down" }} label="↓ Move down" className="btn-link" />}
                  <ButtonForm action={deleteQuestion} fields={{ id: qn.id, paper_id: paper.id }} label="Delete" confirm={`Delete question ${qn.label}?`} />
                </div>
              </div>
            ))}
          </div>
        )}
        <details className="mt-4">
          <summary className="btn-link cursor-pointer">+ Add a question</summary>
          <ActionForm action={saveQuestion} resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-[5rem_1fr_5rem]">
            <input type="hidden" name="paper_id" value={paper.id} />
            <Field label="No."><input name="label" defaultValue={String(questions.length + 1)} /></Field>
            <Field label="Section"><input name="section" defaultValue={questions.at(-1)?.section ?? ""} /></Field>
            <Field label="Marks"><input name="marks" /></Field>
            <Field label="Question" className="sm:col-span-3"><textarea name="body" rows={3} required /></Field>
            <div className="sm:col-span-3"><Submit className="btn">Add question</Submit></div>
          </ActionForm>
        </details>
        <details className="mt-3">
          <summary className="btn-link cursor-pointer">Read all questions again from new text</summary>
          <ActionForm action={rereadQuestions} className="mt-3 grid gap-3" confirm="This replaces every question above. Continue?">
            <input type="hidden" name="id" value={paper.id} />
            <Field label="Paste the paper's text"><textarea name="text" rows={10} className="font-mono" /></Field>
            <Field label="…or a Word / text file"><input type="file" name="file" accept=".docx,.txt,.md" /></Field>
            <div><Submit className="btn">Replace questions</Submit></div>
          </ActionForm>
        </details>
      </Card>

      <Card title="Send for review">
        {staff.length === 0 ? (
          <p className="text-sm">No staff logins yet. <Link className="btn-link" href="/staff">Add the teachers</Link> first, with their classes and subjects.</p>
        ) : (
          <ActionForm action={sendForReview} className="flex flex-col gap-3" confirm="Send this paper to the ticked teachers? Questions can't be edited after this (you can make a revised version).">
            <input type="hidden" name="id" value={paper.id} />
            <p className="text-sm text-muted">
              {previousReviewers.length ? "Ticked: the reviewers of the previous version." : `Ticked: teachers whose subjects include "${paper.subject}" for class ${paper.class_code}.`} Change as needed.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="reviewer" value={s.id} defaultChecked={pre.has(s.id)} className="mt-1" />
                  <span><span className="font-medium">{s.name}</span><br /><span className="text-muted">{s.subjects || "no subjects"} · {s.classes || "any class"}</span></span>
                </label>
              ))}
            </div>
            <div><Submit>Send to reviewers</Submit></div>
          </ActionForm>
        )}
      </Card>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Paper details, file and delete</summary>
        <ActionForm action={savePaperDetails} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="id" value={paper.id} />
          <PaperFields p={paper} />
          <div className="sm:col-span-2 lg:col-span-4"><Submit className="btn">Save details</Submit></div>
        </ActionForm>
        <ActionForm action={replaceFile} className="mt-6 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={paper.id} />
          <Field label={paper.has_file ? `File: ${paper.file_name} – replace with` : "Attach the original file"}><input type="file" name="file" accept=".docx,.doc,.pdf,.txt,.md,.png,.jpg,.jpeg" /></Field>
          <Submit className="btn">Upload</Submit>
        </ActionForm>
        <div className="mt-6"><ButtonForm action={deletePaper} fields={{ id: paper.id }} label="Delete this draft" confirm="Delete this paper and its questions?" /></div>
      </details>
    </div>
  );
}
