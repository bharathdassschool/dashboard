/* eslint-disable @next/next/no-img-element */

/** The school's letterhead: crest, name and school line, as on the printed stationery. */
export function Letterhead({ size = "md", center = false, address = false }: { size?: "sm" | "md" | "lg"; center?: boolean; address?: boolean }) {
  const crest = { sm: "h-11", md: "h-16", lg: "h-24" }[size];
  const name = { sm: "text-xl", md: "text-[1.75rem]", lg: "text-4xl" }[size];
  return (
    <div className={`flex items-center gap-3 sm:gap-4 ${center ? "flex-col text-center" : ""}`}>
      <img src="/crest.png" alt="Bharath Dass School crest" className={`${crest} w-auto shrink-0`} />
      <div className="min-w-0">
        <div className={`serif ${name} font-bold leading-none tracking-[0.12em]`} style={{ color: "var(--primary)" }}>BHARATH DASS</div>
        <div className="mt-1.5 text-[0.6rem] font-semibold uppercase leading-tight tracking-[0.22em] sm:text-[0.68rem]">Matriculation Higher Secondary School</div>
        {address && <div className="mt-1 text-xs text-muted">18 Thirumalai Nagar Annexe, Perungudi, Chennai – 600 096</div>}
      </div>
    </div>
  );
}

export function Motto() {
  return (
    <footer className="mt-16 border-t pt-4 text-center print:hidden" style={{ borderColor: "var(--gold)" }}>
      <span className="serif text-sm italic tracking-[0.3em]" style={{ color: "var(--primary)" }}>LEAD · KINDLY · LIGHT</span>
    </footer>
  );
}
