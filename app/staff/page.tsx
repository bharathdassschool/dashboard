import { ActionForm, ButtonForm, Submit } from "@/components/forms";
import { DbMissing, Shell } from "@/components/Shell";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { getStaffAccounts } from "@/lib/papers";
import { syncStaffFromLeave } from "@/lib/staffSync";
import { addStaff, resetStaffPassword, setStaffActive, updateStaff } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireSession("manager");
  if (!databaseUrl()) return <Shell session={session}><DbMissing /></Shell>;
  const synced = await syncStaffFromLeave();
  const staff = await getStaffAccounts();
  const teachers = staff.filter((s) => s.subjects);
  const others = staff.filter((s) => !s.subjects);
  return (
    <Shell session={session}>
      <PageHeader
        title="Staff"
        subtitle={synced === null
          ? "Couldn't reach the leave system just now – showing the list from last time."
          : `${synced} staff from the leave system. They sign in here with their leave login. Question papers go to teachers by the subjects and classes below.`}
      />
      <Card title={`Teachers · ${teachers.length}`} className="mb-5">
        {teachers.length === 0 ? <Empty>No subjects yet – they fill in as teachers apply for leave, or add them below.</Empty> : <StaffRows rows={teachers} />}
      </Card>
      <Card title={`Everyone else · ${others.length}`} className="mb-5">
        <p className="mb-3 text-sm text-muted">No subjects recorded. Add subjects to anyone who should review question papers.</p>
        {others.length > 0 && (
          <details>
            <summary className="btn-link cursor-pointer">Show</summary>
            <div className="mt-3"><StaffRows rows={others} /></div>
          </details>
        )}
      </Card>
      <details className="card">
        <summary className="eyebrow cursor-pointer">Add someone who isn&apos;t in the leave system</summary>
        <ActionForm action={addStaff} resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Name"><input name="name" required /></Field>
          <Field label="Username"><input name="username" required autoCapitalize="none" /></Field>
          <Field label="Password"><input name="password" required /></Field>
          <Field label="Classes (blank = any)"><input name="classes" placeholder="VIII, IX" /></Field>
          <Field label="Subjects"><input name="subjects" placeholder="Science" /></Field>
          <div className="sm:col-span-2 lg:col-span-5"><Submit className="btn">Add</Submit></div>
        </ActionForm>
      </details>
    </Shell>
  );
}

function StaffRows({ rows }: { rows: Awaited<ReturnType<typeof getStaffAccounts>> }) {
  return (
    <div>
      {rows.map((s) => (
        <details key={s.id} className="border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--border)" }}>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
            <span><span className="font-medium">{s.name}</span>{s.designation && <span className="text-muted"> · {s.designation}</span>}</span>
            <span className="text-muted">
              {s.subjects || "—"}{s.classes && ` · ${s.classes}`} {!s.active && <span className="badge badge-bad ml-1">Off</span>}
            </span>
          </summary>
          <div className="mt-3 grid gap-4 pb-2 lg:grid-cols-[1fr_16rem]">
            <ActionForm action={updateStaff} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="name" value={s.name} />
              <input type="hidden" name="username" value={s.username} />
              <Field label="Subjects (for question papers)"><input name="subjects" defaultValue={s.subjects} /></Field>
              <Field label="Classes (blank = any)"><input name="classes" defaultValue={s.classes} /></Field>
              <div><Submit className="btn">Save</Submit></div>
            </ActionForm>
            <div className="flex flex-col gap-3 text-sm">
              {s.from_leave
                ? <span className="text-muted">Signs in as <strong>{s.username}</strong> (their leave login).</span>
                : (
                  <ActionForm action={resetStaffPassword} resetOnSuccess className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <Field label={`New password for ${s.username}`}><input name="password" required /></Field>
                    <div><Submit className="btn">Change password</Submit></div>
                  </ActionForm>
                )}
              <ButtonForm action={setStaffActive} fields={{ id: s.id, active: s.active ? "0" : "1" }}
                label={s.active ? "Block from the portal" : "Allow on the portal again"} className={s.active ? "btn-link-danger" : "btn-link"}
                confirm={s.active ? `Block ${s.name} from the portal?` : undefined} />
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
