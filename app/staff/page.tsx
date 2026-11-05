import { ActionForm, ButtonForm, Submit } from "@/components/forms";
import { DbMissing, Shell } from "@/components/Shell";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { getStaffAccounts } from "@/lib/papers";
import { addStaff, resetStaffPassword, setStaffActive, updateStaff } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireSession("manager");
  if (!databaseUrl()) return <Shell session={session}><DbMissing /></Shell>;
  const staff = await getStaffAccounts();
  return (
    <Shell session={session}>
      <PageHeader
        title="Staff logins"
        subtitle="Each teacher gets their own login so question papers for their classes and subjects reach them for review. They sign in on this same portal."
      />
      <Card title="Add a staff member" className="mb-6">
        <ActionForm action={addStaff} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Name"><input name="name" required placeholder="Mrs. Kanaka Rani" /></Field>
          <Field label="Username"><input name="username" required autoCapitalize="none" placeholder="kanaka" /></Field>
          <Field label="Password"><input name="password" required placeholder="at least 4 characters" /></Field>
          <Field label="Classes (blank = any)"><input name="classes" placeholder="VIII, IX, X" /></Field>
          <Field label="Subjects"><input name="subjects" placeholder="Science, Maths" /></Field>
          <div className="sm:col-span-2 lg:col-span-5"><Submit>Add staff member</Submit></div>
        </ActionForm>
      </Card>
      <Card title={`Staff (${staff.length})`}>
        {staff.length === 0 ? <Empty>No staff logins yet.</Empty> : (
          <div className="flex flex-col gap-2">
            {staff.map((s) => (
              <details key={s.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{s.name} <span className="text-sm font-normal text-muted">· {s.username}</span></span>
                  <span className="text-sm text-muted">
                    {s.subjects || "no subjects"} · {s.classes || "any class"} {!s.active && <span className="badge badge-bad ml-1">Switched off</span>}
                  </span>
                </summary>
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_16rem]">
                  <ActionForm action={updateStaff} className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={s.id} />
                    <Field label="Name"><input name="name" defaultValue={s.name} required /></Field>
                    <Field label="Username"><input name="username" defaultValue={s.username} required /></Field>
                    <Field label="Classes (blank = any)"><input name="classes" defaultValue={s.classes} /></Field>
                    <Field label="Subjects"><input name="subjects" defaultValue={s.subjects} /></Field>
                    <div><Submit>Save</Submit></div>
                  </ActionForm>
                  <div className="flex flex-col gap-3">
                    <ActionForm action={resetStaffPassword} resetOnSuccess className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <Field label="New password"><input name="password" required /></Field>
                      <div><Submit className="btn">Change password</Submit></div>
                    </ActionForm>
                    <ButtonForm action={setStaffActive} fields={{ id: s.id, active: s.active ? "0" : "1" }}
                      label={s.active ? "Switch off this login" : "Switch this login back on"} className={s.active ? "btn-link-danger" : "btn-link"}
                      confirm={s.active ? `Switch off ${s.name}'s login?` : undefined} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
