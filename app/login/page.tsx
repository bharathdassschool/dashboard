import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { Field } from "@/components/ui";
import { currentRole, portalSecret } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!portalSecret()) return <SetupHint />;
  if (await currentRole()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold">Bharath Dass School</h1>
      <p className="mb-6 text-sm text-muted">School portal – Manager, Admin and Staff</p>
      <ActionForm action={login} className="card flex flex-col gap-4">
        <Field label="Username">
          <input name="username" autoComplete="username" autoCapitalize="none" required autoFocus />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Submit>Sign in</Submit>
      </ActionForm>
    </main>
  );
}

function SetupHint() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-xl font-semibold">Almost there – add the portal key</h1>
      <p className="mt-2 text-sm text-muted">
        In Vercel, open this project → <strong>Settings → Environment Variables</strong> and add <code>PORTAL_SECRET</code> (a long random
        text, 32+ characters). Add the same value to the office, leave and question-paper projects, then redeploy all four.
      </p>
    </main>
  );
}
