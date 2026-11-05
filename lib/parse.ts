/* ------------------------------------------------------------------------------------------------
 * Reading the questions out of a paper made in Claude (pasted text, Markdown or a Word file's text).
 * ---------------------------------------------------------------------------------------------- */

export type ParsedQuestion = { section: string; label: string; body: string; marks: string };

const SECTION_RE = /^(section|part)\s+([a-z0-9ivx]+)\b.*$/i;
// "1.", "1)", "Q1.", "Q.1", "Question 1:" – not "(a)", "i.", or "1.5 marks".
const QUESTION_RE = /^(?:q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*[.):\-–]\s*(?!\d)(.*)$|^q(?:uestion)?\s*\.?\s*(\d{1,3})\s+(.*)$/i;
const INSTRUCTIONS_RE = /^(general\s+)?instructions?\s*:?\s*$/i;
const MARKS_RE = /\s*[\[(]\s*(\d+(?:\.\d+)?)\s*(?:m|marks?|mark)?\s*[\])]\s*$|\s+[-–—]\s*(\d+(?:\.\d+)?)\s*marks?\s*$/i;

function clean(line: string) {
  return line
    .replace(/\r/g, "")
    .replace(/^\s*#{1,6}\s*/, "") // Markdown headings
    .replace(/\*\*/g, "") // bold
    .replace(/__([^_\s][^_]*?)__/g, "$1") // bold written with underscores (but keep fill-in-the-blank lines)
    .replace(/^\s*[-*]\s+(?=(?:q(?:uestion)?\s*\.?\s*)?\d{1,3}\s*[.)])/i, "") // "- 1. ..." list markers
    .replace(/\s+$/, "");
}

export function parseQuestions(text: string): { questions: ParsedQuestion[]; header: string[] } {
  const questions: ParsedQuestion[] = [];
  const header: string[] = [];
  let section = "";
  let inInstructions = false;
  let cur: ParsedQuestion | null = null;
  for (const raw of text.split("\n")) {
    const line = clean(raw);
    const t = line.trim();
    if (INSTRUCTIONS_RE.test(t)) {
      inInstructions = true;
      cur = null;
      header.push(t);
      continue;
    }
    if (SECTION_RE.test(t) && t.length < 120) {
      section = t.replace(/\s*[:\-–]\s*$/, "");
      inInstructions = false;
      cur = null;
      continue;
    }
    const m = inInstructions ? null : QUESTION_RE.exec(t);
    if (m) {
      cur = { section, label: m[1] ?? m[3], body: (m[2] ?? m[4] ?? "").trim(), marks: "" };
      questions.push(cur);
      continue;
    }
    if (cur) {
      // Keep sub-parts, options and blank lines inside the question.
      cur.body = cur.body ? `${cur.body}\n${line}` : line.trim();
    } else if (t) {
      header.push(t);
    }
  }
  for (const qn of questions) {
    qn.body = qn.body.replace(/\n{3,}/g, "\n\n").trim();
    const lines = qn.body.split("\n");
    // Marks written at the end of the question's first or last line become the Marks field.
    for (const i of [0, lines.length - 1]) {
      const hit = MARKS_RE.exec(lines[i]);
      if (hit) {
        qn.marks = hit[1] ?? hit[2];
        lines[i] = lines[i].slice(0, hit.index).trimEnd();
        qn.body = lines.join("\n").trim();
        break;
      }
    }
  }
  return { questions: questions.filter((x) => x.body), header };
}
