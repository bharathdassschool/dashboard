import { unstable_rethrow } from "next/navigation";

export type ActionState = { error?: string; ok?: string; at?: number } | null;

/** Wrap a server action so thrown errors become a message shown next to the form. */
export function action(fn: (fd: FormData) => Promise<string | void>) {
  return async (_prev: ActionState, fd: FormData): Promise<ActionState> => {
    try {
      const ok = await fn(fd);
      return { ok: ok || "Saved.", at: Date.now() };
    } catch (e) {
      unstable_rethrow(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate key/.test(msg)) return { error: "That record already exists.", at: Date.now() };
      console.error(e);
      return { error: msg, at: Date.now() };
    }
  };
}
