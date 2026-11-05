"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/push-actions";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "install-first" | "off" | "on" | "blocked" | "working";

/** Turn this phone's notifications on or off. On iPhone/iPad, Apple only allows it once the app is on the home screen. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "install-first" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setError("");
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      setState("on");
    } catch {
      setError("Couldn't turn them on – try again.");
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  }

  if (state === "loading" || state === "unsupported") return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--muted-bg)" }}>
      <span>
        {state === "on" && "🔔 Notifications are on for this phone."}
        {state === "off" && "Get a notification on this phone when something needs you."}
        {state === "working" && "One moment…"}
        {state === "blocked" && "Notifications are blocked for this app in the phone's Settings."}
        {state === "install-first" && "For notifications, first add the portal to your home screen (Share → Add to Home Screen), then open it from there."}
        {error && <span className="ml-2 text-bad">{error}</span>}
      </span>
      {state === "off" && <button className="btn-primary" onClick={turnOn}>Turn on notifications</button>}
      {state === "on" && <button className="btn-link text-muted" onClick={turnOff}>Turn off</button>}
    </div>
  );
}
