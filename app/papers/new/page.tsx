import { ActionForm } from "@/components/forms";
import { PaperBasics, PaperExtras } from "@/components/PaperFields";
import { DbMissing, Shell } from "@/components/Shell";
import { Card, Field, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { knownSubjects } from "@/lib/papers";
import { createPaper } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  const session = await requireSession("manager");
  if (!databaseUrl()) return <Shell session={session}><DbMissing /></Shell>;
  const subjects = await knownSubjects();
  return (
    <Shell session={session}>
      <PageHeader title="Upload a paper" />
      <ActionForm action={createPaper} className="flex flex-col gap-5">
        <Card title="1 · Which paper">
          <div className="grid gap-4 sm:grid-cols-3"><PaperBasics subjects={subjects} /></div>
        </Card>
        <Card title="2 · The file">
          <Field label="PDF or Word file (up to 4 MB)">
            <input type="file" name="file" required accept=".pdf,.docx" />
          </Field>
          <p className="mt-2 text-xs text-muted">Each question is read by its number (1. 2. Q3 …) so teachers can review them one by one. Marks, time and instructions are read from the paper&apos;s heading.</p>
        </Card>
        <details className="card">
          <summary className="eyebrow cursor-pointer">More · marks, time, instructions, note to reviewers</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PaperExtras /></div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" name="intent" value="send" className="btn-primary">Upload & send to teachers</button>
          <button type="submit" name="intent" value="check" className="btn">Upload & check first</button>
          <span className="text-xs text-muted">Sent to the teachers of that subject and class.</span>
        </div>
      </ActionForm>
    </Shell>
  );
}
