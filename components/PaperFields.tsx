import { Field } from "@/components/ui";
import { CLASSES, EXAMS, type Paper } from "@/lib/papers";

/** Class, subject, exam and the paper's printed heading – used when uploading and when editing. */
export function PaperFields({ p, optional = false }: { p?: Partial<Paper>; optional?: boolean }) {
  return (
    <>
      <Field label="Class">
        <select name="class_code" required={!optional} defaultValue={p?.class_code ?? ""}>
          <option value="" disabled={!optional}>{optional ? "From the paper" : "Choose…"}</option>
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Subject"><input name="subject" required={!optional} defaultValue={p?.subject} placeholder={optional ? "From the paper" : "Science"} /></Field>
      <Field label="Exam">
        <input name="exam" list="exam-list" defaultValue={p?.exam} placeholder="Quarterly" />
      </Field>
      <datalist id="exam-list">{EXAMS.map((e) => <option key={e} value={e} />)}</datalist>
      <Field label="Academic year"><input name="academic_year" defaultValue={p?.academic_year} placeholder="2026-27" /></Field>
      <Field label="Max. marks"><input name="max_marks" defaultValue={p?.max_marks} placeholder="50" /></Field>
      <Field label="Time"><input name="duration" defaultValue={p?.duration} placeholder="1½ hours" /></Field>
      <Field label="Title (optional)" className="sm:col-span-2"><input name="title" defaultValue={p?.title} placeholder="Shown at the top of the paper" /></Field>
      <Field label="General instructions (printed on the paper)" className="sm:col-span-2 lg:col-span-4">
        <textarea name="instructions" rows={3} defaultValue={p?.instructions} placeholder={"1. All questions are compulsory.\n2. …"} />
      </Field>
      <Field label="Note to reviewers (not printed)" className="sm:col-span-2 lg:col-span-4">
        <textarea name="note_to_reviewers" rows={2} defaultValue={p?.note_to_reviewers} placeholder="e.g. Portions: Lessons 1–6. Please check the diagrams in Section C." />
      </Field>
    </>
  );
}
