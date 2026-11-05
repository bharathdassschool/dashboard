import { ActionForm, Submit } from "@/components/forms";
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
      <PageHeader title="Upload a question paper" subtitle="Paste the paper Claude wrote (or upload its Word file). The questions are read out one by one so teachers can review each of them." />
      <ActionForm action={createPaper} className="flex flex-col gap-6">
        <Card title="1. Which paper">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PaperFields /></div>
        </Card>
        <Card title="2. The paper">
          <div className="grid gap-4">
            <Field label="Paste the paper's text from Claude">
              <textarea name="text" rows={14} placeholder={"Section A\n1. Which of these is a conductor? [1]\n   a) Wood  b) Copper  c) Plastic  d) Rubber\n2. …"} className="font-mono" />
            </Field>
            <Field label="…and / or upload the file (Word .docx, PDF, text or photo, up to 4 MB)">
              <input type="file" name="file" accept=".docx,.doc,.pdf,.txt,.md,.png,.jpg,.jpeg" />
            </Field>
            <p className="text-sm text-muted">
              Each question should start with its number (<code>1.</code>, <code>2)</code>, <code>Q3</code> …); headings like <em>Section A</em> are kept.
              From a Word file the text is read automatically. For a PDF or photo, also paste the text so the questions can be reviewed one by one – the file is kept
              for viewing and printing. You can check and fix every question on the next page before sending it.
            </p>
          </div>
        </Card>
        <div><Submit>Upload and check questions</Submit></div>
      </ActionForm>
    </Shell>
  );
}
