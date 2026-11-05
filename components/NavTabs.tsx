"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabs({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));
  return (
    <nav className="mt-3 flex flex-wrap gap-5">
      {links.map((l) => <Link key={l.href} href={l.href} className={`tab ${active(l.href) ? "tab-active" : ""}`}>{l.label}</Link>)}
    </nav>
  );
}
