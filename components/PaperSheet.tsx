import { Letterhead } from "@/components/Letterhead";
import type { Paper, Question } from "@/lib/papers";

/** "Quarterly" → "Quarterly Examination"; anything already naming a test or exam stays as it is. */
function examHeading(exam: string) {
  return !exam || /exam|test/i.test(exam) ? exam : `${exam} Examination`;
}

/** The paper as it is printed: school heading, class / subject / marks / time, instructions, questions by section. */
export function PaperSheet({ paper, questions, children }: { paper: Paper; questions: Question[]; children?: (q: Question) => React.ReactNode }) {
  let section = "";
  return (
    <article className="paper-sheet">
      <header className="mb-4 text-center">
        <div className="flex justify-center"><Letterhead size="sm" /></div>
        <div className="rule my-3" />
        {(paper.exam || paper.academic_year) && <div className="serif text-lg font-semibold">{[examHeading(paper.exam), paper.academic_year].filter(Boolean).join(" · ")}</div>}
        {paper.title && <div>{paper.title}</div>}
        <div className="mt-2 flex flex-wrap justify-between gap-2 border-y py-1 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
          <span>Class: {paper.class_code}</span>
          <span>Subject: {paper.subject}</span>
          {paper.max_marks && <span>Max. marks: {paper.max_marks}</span>}
          {paper.duration && <span>Time: {paper.duration}</span>}
        </div>
      </header>
      {paper.instructions && (
        <div className="mb-4 text-sm">
          <div className="font-semibold">General instructions</div>
          <div className="whitespace-pre-wrap">{paper.instructions}</div>
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {questions.map((qn) => {
          const heading = qn.section && qn.section !== section ? qn.section : null;
          section = qn.section;
          return (
            <li key={qn.id} className="list-none break-inside-avoid">
              {heading && <div className="mb-2 mt-3 text-center font-semibold uppercase">{heading}</div>}
              <div className="flex gap-3">
                <span className="w-8 shrink-0 font-semibold">{qn.label ? `${qn.label}.` : ""}</span>
                <div className="min-w-0 flex-1 whitespace-pre-wrap">{qn.body}</div>
                {qn.marks && <span className="shrink-0 text-sm font-medium tabular-nums">[{qn.marks}]</span>}
              </div>
              {children?.(qn)}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
