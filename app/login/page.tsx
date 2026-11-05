import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { Letterhead, Motto } from "@/components/Letterhead";
import { Field } from "@/components/ui";
import { currentRole, portalSecret } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ready = !!portalSecret();
  if (ready && (await currentRole())) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Letterhead size="lg" center />
      <div className="rule my-6" />
      {ready ? (
        <ActionForm action={login} className="flex flex-col gap-4">
          <Field label="Username"><input name="username" autoComplete="username" autoCapitalize="none" required autoFocus /></Field>
          <Field label="Password"><input name="password" type="password" autoComplete="current-password" required /></Field>
          <Submit>Sign in</Submit>
        </ActionForm>
      ) : (
        <p className="text-center text-sm text-muted">
          Add <code>PORTAL_SECRET</code> (32+ characters) in Vercel → Settings → Environment Variables, then redeploy.
        </p>
      )}
      <Motto />
    </main>
  );
}
