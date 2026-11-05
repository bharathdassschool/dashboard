import { ActionForm } from "@/components/forms";
import { PaperFields } from "@/components/PaperFields";
import { DbMissing, Shell } from "@/components/Shell";
import { Card, Field, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { createPaper } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  const session = await requireSession("manager");
  if (!databaseUrl()) return <Shell session={session}><DbMissing /></Shell>;
  return (
    <Shell session={session}>
      <PageHeader title="Upload a paper" subtitle="Paste what Claude wrote. Class, subject, exam, marks and time are read from the paper's heading." />
      <ActionForm action={createPaper} className="flex flex-col gap-5">
        <Card>
          <div className="grid gap-4">
            <Field label="Paper">
              <textarea name="text" rows={16} className="font-mono" placeholder={"Class: VIII   Subject: Science   Max. marks: 50   Time: 1½ hours\n\nSection A\n1. Which of these is a conductor? [1]\n…"} />
            </Field>
            <Field label="Or the file (Word, PDF, text or photo · up to 4 MB)">
              <input type="file" name="file" accept=".docx,.doc,.pdf,.txt,.md,.png,.jpg,.jpeg" />
            </Field>
          </div>
        </Card>
        <details className="card">
          <summary className="eyebrow cursor-pointer">Details · only if they aren&apos;t in the paper</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PaperFields optional /></div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" name="intent" value="send" className="btn-primary">Upload & send to teachers</button>
          <button type="submit" name="intent" value="check" className="btn">Upload & check first</button>
          <span className="text-xs text-muted">Sent to the teachers whose subject and class match (Staff page).</span>
        </div>
      </ActionForm>
    </Shell>
  );
}
