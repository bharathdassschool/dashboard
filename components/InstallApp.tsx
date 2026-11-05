"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * On a phone, a small one-line offer to add the portal to the home screen, until it's installed or dismissed.
 * Android shows an Install button; iPhone/iPad explain Share → Add to Home Screen (Apple allows nothing else).
 */
export function InstallApp() {
  const [show, setShow] = useState<"android" | "ios" | null>(null);
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem("bd-install-dismissed") === "1"; } catch {}
    if (standalone || dismissed || window.innerWidth > 900) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) setShow("ios");
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as PromptEvent); setShow("android"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;
  const close = () => { try { localStorage.setItem("bd-install-dismissed", "1"); } catch {} setShow(null); };
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--muted-bg)" }}>
      {show === "android"
        ? <span>Add the portal to your home screen.</span>
        : <span>To add the portal to your home screen: tap <strong>Share</strong> <span aria-hidden>⎋</span> then <strong>Add to Home Screen</strong>.</span>}
      <span className="flex shrink-0 gap-3">
        {show === "android" && prompt && (
          <button className="btn-link" onClick={async () => { await prompt.prompt(); await prompt.userChoice; close(); }}>Install</button>
        )}
        <button className="btn-link text-muted" onClick={close} aria-label="Dismiss">Not now</button>
      </span>
    </div>
  );
}
