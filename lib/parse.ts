/* ------------------------------------------------------------------------------------------------
 * Reading the questions out of a paper made in Claude (pasted text, Markdown or a Word file's text).
 * ---------------------------------------------------------------------------------------------- */

export type ParsedQuestion = { section: string; label: string; body: string; marks: string };

const SECTION_RE = /^(section|part)(?:\s+|\s*[-–—:.]\s*)([a-z0-9ivx]{1,4})\b.*$/i;
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

/* ------------------------------------------------------------------------------------------------
 * Reading the paper's details (class, subject, exam …) from its heading, so nobody has to type them.
 * ---------------------------------------------------------------------------------------------- */

export type DetectedDetails = {
  class_code: string; subject: string; exam: string; academic_year: string; max_marks: string; duration: string; instructions: string;
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const EXAM_WORDS: [RegExp, string][] = [
  [/\bquarterly\b/i, "Quarterly"],
  [/\bhalf[\s-]*yearly\b/i, "Half Yearly"],
  [/\b(annual|final)\s+exam/i, "Annual"],
  [/\bannual\b/i, "Annual"],
  [/\bunit\s*test\b/i, "Unit test"],
  [/\brevision\s*(test|exam)/i, "Revision test"],
  [/\b(pre[\s-]*board|model\s+exam|board\s+exam)/i, "Board examination (model)"],
  [/\bmid[\s-]*term\b/i, "Mid-term"],
];
const STOP = String.raw`(?=\s{2,}|\s*[|,;]|\s+(?:max|maximum|total|marks?|time|duration|class|std|exam|date)\b|$)`;

function normaliseClass(raw: string) {
  const v = raw.toUpperCase().replace(/\s+/g, "").replace(/^STD\.?/, "");
  if (/^\d{1,2}$/.test(v)) return ROMAN[Number(v)] ?? "";
  return ["LKG", "UKG", ...ROMAN.slice(1)].includes(v) ? v : "";
}

export function detectDetails(text: string): DetectedDetails {
  const { header } = parseQuestions(text);
  const top = header.join("\n");
  const pick = (re: RegExp) => re.exec(top)?.[1]?.trim() ?? "";
  const cls = normaliseClass(pick(/\b(?:class|std\.?|standard|grade)\s*[:\-–]?\s*(LKG|UKG|[IVX]{1,4}|\d{1,2})\b/i));
  const subject = pick(new RegExp(String.raw`\bsubject\s*[:\-–]\s*([A-Za-z஀-௿ऀ-ॿ][^\n|,;]{0,40}?)${STOP}`, "im"));
  const marks = pick(/\b(?:max(?:imum)?\.?\s*marks?|total\s*marks?|marks)\s*[:\-–]?\s*(\d{1,3})\b/i);
  const duration = pick(/\b(?:time(?:\s*allowed)?|duration)\s*[:\-–]?\s*((?:\d+(?:\.\d+)?|[½¼¾]|\d+\s*[½¼¾])\s*(?:hours?|hrs?\.?|minutes?|mins?\.?)(?:\s*(?:and\s*)?\d+\s*(?:minutes?|mins?\.?))?)/i);
  const year = /\b(20\d{2})\s*[-–/]\s*(20)?(\d{2})\b/.exec(top);
  const exam = EXAM_WORDS.find(([re]) => re.test(top))?.[1] ?? "";
  // Lines after a "General instructions" heading.
  const at = header.findIndex((h) => /^(general\s+)?instructions?\s*:?\s*$/i.test(h));
  const instructions = at >= 0 ? header.slice(at + 1).join("\n") : "";
  return {
    class_code: cls,
    subject: subject.replace(/\s*[-–:]\s*$/, ""),
    exam,
    academic_year: year ? `${year[1]}-${year[3]}` : "",
    max_marks: marks,
    duration: duration.replace(/\bhrs?\.?$/i, "hours").replace(/\s+/g, " "),
    instructions,
  };
}

/** The current school year, June to May (e.g. "2026-27"). */
export function currentAcademicYear(d = new Date()) {
  const y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}
