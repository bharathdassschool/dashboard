"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";

type Act = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const Pending = createContext(false);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
}: {
  action: Act;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      className={className}
      // Submitted by hand rather than through the form's action, so React doesn't clear what was typed:
      // when the server rejects something, people fix that one field instead of filling the form in again.
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || (confirm && !window.confirm(confirm))) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.error && <p className="msg-error col-span-full" role="alert">{state.error}</p>}
      {state?.ok && <p className="msg-ok col-span-full" role="status">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const inActionForm = useContext(Pending);
  const pending = useFormStatus().pending || inActionForm;
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

/** A one-button form, e.g. Delete, with a confirmation prompt. */
export function ButtonForm({
  action,
  fields,
  label,
  confirm,
  className = "btn-link-danger",
}: {
  action: Act;
  fields: Record<string, string | number>;
  label: string;
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {pending ? "…" : label}
      </button>
      {state?.error && <span className="msg-error ml-2">{state.error}</span>}
    </form>
  );
}
