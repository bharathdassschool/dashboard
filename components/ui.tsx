import Link from "next/link";

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold" style={{ color: "var(--primary)" }}>{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="eyebrow" style={{ fontFamily: "inherit" }}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** One figure: small label, large number. Put several in <Stats>. */
export function Stat({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: "good" | "bad" | "warn"; hint?: React.ReactNode }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "";
  return (
    <div className="min-w-0 py-1 sm:px-5 sm:first:pl-0">
      <div className="eyebrow">{label}</div>
      <div className={`serif mt-1 text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** A row of figures separated by thin lines. */
export function Stats({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-y-4 sm:flex sm:flex-wrap sm:divide-x sm:divide-[var(--border)] ${className}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status === "Paid" ? "badge-good" : status === "Partial" ? "badge-warn" : "badge-muted";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

export function Tabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`tab ${i.label === current ? "tab-active" : ""}`}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
