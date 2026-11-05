import { Field } from "@/components/ui";
import { CLASSES, EXAMS, type Paper } from "@/lib/papers";

/** The three things every paper needs: class, exam and subject. */
export function PaperBasics({ p, subjects = [] }: { p?: Partial<Paper>; subjects?: string[] }) {
  const exams = p?.exam && !EXAMS.includes(p.exam) ? [...EXAMS, p.exam] : EXAMS;
  return (
    <>
      <Field label="Class">
        <select name="class_code" required defaultValue={p?.class_code ?? ""}>
          <option value="" disabled>Choose…</option>
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Exam">
        <select name="exam" required defaultValue={p?.exam ?? ""}>
          <option value="" disabled>Choose…</option>
          {exams.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </Field>
      <Field label="Subject">
        <input name="subject" required list="subject-list" defaultValue={p?.subject} placeholder="e.g. Science" autoComplete="off" />
      </Field>
      <datalist id="subject-list">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
    </>
  );
}

/** Everything else on the paper's heading – usually read from the paper itself. */
export function PaperExtras({ p }: { p?: Partial<Paper> }) {
  return (
    <>
      <Field label="Academic year"><input name="academic_year" defaultValue={p?.academic_year} placeholder="From the paper, or this year" /></Field>
      <Field label="Max. marks"><input name="max_marks" defaultValue={p?.max_marks} placeholder="From the paper" /></Field>
      <Field label="Time"><input name="duration" defaultValue={p?.duration} placeholder="From the paper" /></Field>
      <Field label="Title (optional)"><input name="title" defaultValue={p?.title} /></Field>
      <Field label="General instructions (printed)" className="sm:col-span-2 lg:col-span-4">
        <textarea name="instructions" rows={3} defaultValue={p?.instructions} placeholder="From the paper" />
      </Field>
      <Field label="Note to reviewers (not printed)" className="sm:col-span-2 lg:col-span-4">
        <textarea name="note_to_reviewers" rows={2} defaultValue={p?.note_to_reviewers} placeholder="e.g. Portions: Lessons 1–6." />
      </Field>
    </>
  );
}

/** Both, for editing a draft. */
export function PaperFields({ p }: { p?: Partial<Paper> }) {
  return <><PaperBasics p={p} /><PaperExtras p={p} /></>;
}
