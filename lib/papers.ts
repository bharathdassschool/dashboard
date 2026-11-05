import "server-only";
import { q, q1 } from "./db";

export type Paper = {
  id: number; title: string; class_code: string; subject: string; exam: string; academic_year: string;
  max_marks: string; duration: string; instructions: string; note_to_reviewers: string;
  version: number; previous_id: number | null; status: "draft" | "in_review" | "closed"; outcome: "" | "final" | "revised" | "rejected";
  file_name: string; file_type: string; has_file: boolean; created_at: string; sent_at: string | null; closed_at: string | null;
};
export type Question = { id: number; paper_id: number; sort_order: number; section: string; label: string; body: string; marks: string };
export type Decision = "" | "approved" | "approved_with_changes" | "disapproved";
export type Reason = "" | "too_many_changes" | "fundamental";
export type Reviewer = {
  paper_id: number; staff_id: number; name: string; decision: Decision; reason: Reason; comment: string;
  saved_at: string | null; submitted_at: string | null; return_note: string;
};
export type QuestionReview = { question_id: number; staff_id: number; verdict: "ok" | "change"; comment: string };
export type StaffAccount = { id: number; name: string; username: string; classes: string; subjects: string; active: boolean; designation: string; from_leave: boolean; email: string };

export const DECISION_LABEL: Record<Exclude<Decision, "">, string> = {
  approved: "Approved",
  approved_with_changes: "Approved with changes",
  disapproved: "Disapproved",
};
export const REASON_LABEL: Record<Exclude<Reason, "">, string> = {
  too_many_changes: "Too many changes to go ahead",
  fundamental: "Something fundamentally wrong",
};
export const OUTCOME_LABEL: Record<Exclude<Paper["outcome"], "">, string> = {
  final: "Final – ready to print",
  revised: "Replaced by a revised version",
  rejected: "Rejected",
};

export const CLASSES = ["LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const EXAMS = ["Quarterly", "Half Yearly", "Annual"];

const PAPER_COLS = `p.id, p.title, p.class_code, p.subject, p.exam, p.academic_year, p.max_marks, p.duration, p.instructions,
  p.note_to_reviewers, p.version, p.previous_id, p.status, p.outcome, p.file_name, p.file_type, (p.file_data IS NOT NULL) AS has_file,
  p.created_at::text, p.sent_at::text, p.closed_at::text`;

export function paperTitle(p: Pick<Paper, "title" | "class_code" | "subject" | "exam">) {
  return p.title || `Class ${p.class_code} · ${p.subject}${p.exam ? ` · ${p.exam}` : ""}`;
}

export function getPaper(id: number) {
  return q1<Paper>(`SELECT ${PAPER_COLS} FROM qp_papers p WHERE p.id = $1`, [id]);
}

export function getQuestions(paperId: number) {
  return q<Question>("SELECT id, paper_id, sort_order, section, label, body, marks FROM qp_questions WHERE paper_id = $1 ORDER BY sort_order, id", [paperId]);
}

export function getReviewers(paperId: number) {
  return q<Reviewer>(
    `SELECT r.paper_id, r.staff_id, s.name, r.decision, r.reason, r.comment, r.saved_at::text, r.submitted_at::text, r.return_note
     FROM qp_reviewers r JOIN staff_accounts s ON s.id = r.staff_id WHERE r.paper_id = $1 ORDER BY s.name`,
    [paperId],
  );
}

export function getQuestionReviews(paperId: number, staffId?: number) {
  return q<QuestionReview>(
    `SELECT qr.question_id, qr.staff_id, qr.verdict, qr.comment FROM qp_question_reviews qr
     JOIN qp_questions qq ON qq.id = qr.question_id WHERE qq.paper_id = $1 AND ($2::int IS NULL OR qr.staff_id = $2)`,
    [paperId, staffId ?? null],
  );
}

export type PaperRow = Paper & { reviewers: number; submitted: number; approved: number; with_changes: number; disapproved: number; questions: number };

const LIST_SQL = `SELECT ${PAPER_COLS},
    (SELECT COUNT(*)::int FROM qp_questions qq WHERE qq.paper_id = p.id) AS questions,
    (SELECT COUNT(*)::int FROM qp_reviewers r WHERE r.paper_id = p.id) AS reviewers,
    (SELECT COUNT(*)::int FROM qp_reviewers r WHERE r.paper_id = p.id AND r.submitted_at IS NOT NULL) AS submitted,
    (SELECT COUNT(*)::int FROM qp_reviewers r WHERE r.paper_id = p.id AND r.decision = 'approved' AND r.submitted_at IS NOT NULL) AS approved,
    (SELECT COUNT(*)::int FROM qp_reviewers r WHERE r.paper_id = p.id AND r.decision = 'approved_with_changes' AND r.submitted_at IS NOT NULL) AS with_changes,
    (SELECT COUNT(*)::int FROM qp_reviewers r WHERE r.paper_id = p.id AND r.decision = 'disapproved' AND r.submitted_at IS NOT NULL) AS disapproved
  FROM qp_papers p`;

/** Manager: every paper. Admin: everything already sent out (drafts are the Manager's work in progress). */
export function listPapers(opts: { includeDrafts: boolean }) {
  return q<PaperRow>(`${LIST_SQL} ${opts.includeDrafts ? "" : "WHERE p.status <> 'draft'"} ORDER BY p.created_at DESC, p.id DESC`);
}

export type MyPaperRow = PaperRow & { my_saved_at: string | null; my_submitted_at: string | null; my_decision: Decision };

/** Papers sent to one reviewer. */
export function listMyPapers(staffId: number) {
  return q<MyPaperRow>(
    `SELECT x.*, me.saved_at::text AS my_saved_at, me.submitted_at::text AS my_submitted_at, me.decision AS my_decision
     FROM (${LIST_SQL}) x JOIN qp_reviewers me ON me.paper_id = x.id AND me.staff_id = $1
     WHERE x.status <> 'draft' ORDER BY (me.submitted_at IS NOT NULL), x.sent_at DESC NULLS LAST`,
    [staffId],
  );
}

export async function countToReview(staffId: number) {
  const r = await q1<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM qp_reviewers r JOIN qp_papers p ON p.id = r.paper_id
     WHERE r.staff_id = $1 AND p.status = 'in_review' AND r.submitted_at IS NULL`,
    [staffId],
  );
  return r?.n ?? 0;
}

export function getStaffAccounts(opts: { activeOnly?: boolean } = {}) {
  return q<StaffAccount>(`SELECT id, name, username, classes, subjects, active, designation, email, (leave_user_id IS NOT NULL) AS from_leave FROM staff_accounts ${opts.activeOnly ? "WHERE active" : ""} ORDER BY active DESC, lower(name)`);
}

/** Splits "VIII A, IX; Science / Maths" style lists into lowercase tokens for matching. */
function tokens(s: string) {
  return s.toLowerCase().split(/[,;/\n]+/).map((t) => t.trim()).filter(Boolean);
}

/** Short forms teachers use for the same subject, so "Maths" matches a paper headed "Mathematics". */
const SUBJECT_ALIASES: [RegExp, string][] = [
  [/^(maths?|mathematics|math)$/, "mathematics"],
  [/^(sci|science|gen(eral)? science)$/, "science"],
  [/^(eng|english|english language)$/, "english"],
  [/^(social|social science|social studies|sst|soc\.? sci\.?)$/, "social science"],
  [/^(cs|comp|computer|computers|computer science)$/, "computer science"],
  [/^(evs|environmental studies|environmental science)$/, "evs"],
  [/^(phy|physics)$/, "physics"],
  [/^(chem|chemistry)$/, "chemistry"],
  [/^(bio|biology)$/, "biology"],
  [/^(tam|tamil)$/, "tamil"],
  [/^(hin|hindi)$/, "hindi"],
];
function subjectKey(s: string) {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  return SUBJECT_ALIASES.find(([re]) => re.test(t))?.[1] ?? t;
}

/** Whether a staff member's classes and subjects cover a paper (used to pre-tick reviewers). */
export function matchesPaper(s: Pick<StaffAccount, "classes" | "subjects">, p: Pick<Paper, "class_code" | "subject">) {
  const subj = subjectKey(p.subject);
  const cls = p.class_code.toLowerCase().trim();
  const subjOk = tokens(s.subjects).map(subjectKey).some((t) => t === subj || t.includes(subj) || subj.includes(t));
  const classes = tokens(s.classes);
  // "VIII A" counts as class VIII; an empty class list means "any class".
  const clsOk = classes.length === 0 || classes.some((t) => t === cls || t.split(/\s+/)[0] === cls);
  return subjOk && clsOk;
}

export { currentAcademicYear, detectDetails, parseQuestions, type DetectedDetails, type ParsedQuestion } from "./parse";

/** Text of a PDF (one made by Claude, or any PDF with real text – not a scan), or "" when it can't be read. */
export async function pdfText(buf: Buffer) {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).join("\n");
  } catch {
    return "";
  }
}

/** Text of an uploaded Word file (.docx), or "" when it can't be read. */
export async function docxText(buf: Buffer) {
  try {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: buf })).value;
  } catch {
    return "";
  }
}

/** Counts for the Manager's home page. */
export async function paperCounts() {
  const r = await q1<{ drafts: number; in_review: number; waiting: number; final: number; flagged: number; ready: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'in_review' AND NOT EXISTS (SELECT 1 FROM qp_reviewers r WHERE r.paper_id = qp_papers.id AND r.submitted_at IS NULL))::int AS ready,
       COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
       COUNT(*) FILTER (WHERE status = 'in_review')::int AS in_review,
       COUNT(*) FILTER (WHERE outcome = 'final')::int AS final,
       (SELECT COUNT(*)::int FROM qp_reviewers r JOIN qp_papers p ON p.id = r.paper_id WHERE p.status = 'in_review' AND r.submitted_at IS NULL) AS waiting,
       (SELECT COUNT(*)::int FROM qp_reviewers r JOIN qp_papers p ON p.id = r.paper_id
          WHERE p.status = 'in_review' AND r.submitted_at IS NOT NULL AND r.decision IN ('approved_with_changes', 'disapproved')) AS flagged
     FROM qp_papers`,
  );
  return r ?? { drafts: 0, in_review: 0, waiting: 0, final: 0, flagged: 0, ready: 0 };
}

/** Subjects teachers handle (from the Staff page), to suggest when uploading. */
export async function knownSubjects() {
  const rows = await q<{ subjects: string }>("SELECT subjects FROM staff_accounts WHERE active AND subjects <> ''");
  const set = new Map<string, string>();
  for (const r of rows) for (const t of r.subjects.split(/[,;/\n]+/)) {
    const v = t.trim();
    if (v && !set.has(v.toLowerCase())) set.set(v.toLowerCase(), v);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

/** Reviews the Manager sent back to this teacher with a note, still to be sent again. */
export function returnedReviews(staffId: number) {
  return q<{ paper_id: number; class_code: string; subject: string; exam: string; return_note: string }>(
    `SELECT p.id AS paper_id, p.class_code, p.subject, p.exam, r.return_note FROM qp_reviewers r JOIN qp_papers p ON p.id = r.paper_id
     WHERE r.staff_id = $1 AND r.submitted_at IS NULL AND r.return_note <> '' AND p.status = 'in_review' ORDER BY p.id`,
    [staffId],
  );
}
