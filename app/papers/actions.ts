"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action } from "@/lib/action";
import { requireActor } from "@/lib/auth";
import { q, q1, tx } from "@/lib/db";
import { id, ids, str } from "@/lib/forms";
import { syncStaffFromLeave } from "@/lib/staffSync";
import { managerEmails, sendMail } from "@/lib/mail";
import {
  currentAcademicYear, detectDetails, docxText, pdfText, getPaper, getQuestions, getStaffAccounts, matchesPaper, parseQuestions, type Decision, type Reason,
} from "@/lib/papers";

const MAX_FILE = 4 * 1024 * 1024;
const TEXT_MAX = 200_000;
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const manager = () => requireActor("manager");

function refresh(paperId?: number) {
  revalidatePath("/papers");
  if (paperId) revalidatePath(`/papers/${paperId}`);
  revalidatePath("/");
}

async function readFile(fd: FormData) {
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAX_FILE) throw new Error("The file is larger than 4 MB. Save it as a smaller PDF, or paste the text instead.");
  const ext = /\.([a-z0-9]+)$/i.exec(f.name)?.[1].toLowerCase() ?? "";
  // The type comes from the file name, never from the browser, so a file can only ever open as what it says it is.
  const type = FILE_TYPES[ext];
  if (!type) throw new Error("Upload a PDF, Word (.docx), text, or photo (JPG/PNG) file.");
  return { name: f.name.slice(0, 200), type, data: Buffer.from(await f.arrayBuffer()) };
}

/** The paper's text: what was pasted, or else the text of an uploaded Word / text file. */
async function paperText(fd: FormData, file: Awaited<ReturnType<typeof readFile>>) {
  const pasted = String(fd.get("text") ?? "").slice(0, TEXT_MAX);
  if (pasted.trim()) return pasted;
  if (!file) return "";
  if (/\.docx$/i.test(file.name)) return docxText(file.data);
  if (/\.pdf$/i.test(file.name)) return pdfText(file.data);
  if (/\.(txt|md)$/i.test(file.name)) return file.data.toString("utf8").slice(0, TEXT_MAX);
  return "";
}

/** Details typed in the form; anything left blank is read from the paper's own heading. */
function details(fd: FormData, text = "") {
  const found = text ? detectDetails(text) : null;
  const get = (k: keyof NonNullable<typeof found>, max: number) => str(fd, k, max) || found?.[k] || "";
  const class_code = get("class_code", 20);
  const subject = get("subject", 100);
  if (!class_code || !subject) {
    throw new Error(`Couldn't find the ${!class_code && !subject ? "class and subject" : !class_code ? "class" : "subject"} in the paper – choose ${!class_code && !subject ? "them" : "it"} under Details.`);
  }
  return {
    class_code, subject,
    title: str(fd, "title", 200), exam: get("exam", 100), academic_year: get("academic_year", 20) || currentAcademicYear(),
    max_marks: get("max_marks", 20), duration: get("duration", 50),
    instructions: get("instructions", 5000), note_to_reviewers: str(fd, "note_to_reviewers", 5000),
  };
}

async function insertQuestions(c: { query: (t: string, p: unknown[]) => Promise<unknown> }, paperId: number, text: string) {
  const { questions } = parseQuestions(text);
  let i = 0;
  for (const qn of questions) {
    await c.query("INSERT INTO qp_questions (paper_id, sort_order, section, label, body, marks) VALUES ($1, $2, $3, $4, $5, $6)", [
      paperId, (i += 10), qn.section.slice(0, 300), qn.label.slice(0, 20), qn.body.slice(0, 20000), qn.marks.slice(0, 20),
    ]);
  }
  return questions.length;
}

/* ---------------- Manager: upload and prepare ---------------- */

export const createPaper = action(async (fd) => {
  await manager();
  const file = await readFile(fd);
  const text = await paperText(fd, file);
  if (!text.trim() && !file) throw new Error("Paste the paper's text from Claude, or upload the file.");
  const d = details(fd, text);
  const sendNow = fd.get("intent") === "send";
  // "Upload & send": straight to the teachers whose classes and subjects match – no extra step.
  if (sendNow) await syncStaffFromLeave();
  const reviewers = sendNow ? (await getStaffAccounts({ activeOnly: true })).filter((s) => matchesPaper(s, d)).map((s) => s.id) : [];
  const paperId = await tx(async (c) => {
    const r = await c.query<{ id: number }>(
      `INSERT INTO qp_papers (title, class_code, subject, exam, academic_year, max_marks, duration, instructions, note_to_reviewers, file_name, file_type, file_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [d.title, d.class_code, d.subject, d.exam, d.academic_year, d.max_marks, d.duration, d.instructions, d.note_to_reviewers,
        file?.name ?? "", file?.type ?? "", file?.data ?? null],
    );
    const pid = r.rows[0].id;
    const n = text.trim() ? await insertQuestions(c, pid, text) : 0;
    if (sendNow && n && reviewers.length) {
      for (const s of reviewers) await c.query("INSERT INTO qp_reviewers (paper_id, staff_id) VALUES ($1, $2)", [pid, s]);
      await c.query("UPDATE qp_papers SET status='in_review', sent_at=now() WHERE id=$1", [pid]);
    }
    return pid;
  });
  refresh();
  const sent = sendNow && reviewers.length && (await getPaper(paperId))?.status === "in_review";
  if (sent) await notifyReviewers(paperId, reviewers);
  redirect(`/papers/${paperId}?${sent ? "sent" : sendNow ? "nosend" : "new"}=1`);
});

export const savePaperDetails = action(async (fd) => {
  await manager();
  const pid = id(fd);
  const d = details(fd);
  await q(
    `UPDATE qp_papers SET title=$1, class_code=$2, subject=$3, exam=$4, academic_year=$5, max_marks=$6, duration=$7, instructions=$8, note_to_reviewers=$9
     WHERE id=$10`,
    [d.title, d.class_code, d.subject, d.exam, d.academic_year, d.max_marks, d.duration, d.instructions, d.note_to_reviewers, pid],
  );
  refresh(pid);
  return "Details saved.";
});

export const replaceFile = action(async (fd) => {
  await manager();
  const pid = id(fd);
  const file = await readFile(fd);
  if (!file) throw new Error("Choose a file first.");
  await q("UPDATE qp_papers SET file_name=$1, file_type=$2, file_data=$3 WHERE id=$4", [file.name, file.type, file.data, pid]);
  refresh(pid);
  return "File uploaded.";
});

async function draftOnly(pid: number) {
  const p = await getPaper(pid);
  if (!p) throw new Error("That paper no longer exists.");
  if (p.status !== "draft") throw new Error("Questions can only be changed before the paper is sent. Make a revised version instead.");
  return p;
}

export const rereadQuestions = action(async (fd) => {
  await manager();
  const pid = id(fd);
  await draftOnly(pid);
  const file = await readFile(fd);
  const text = await paperText(fd, file);
  if (!text.trim()) throw new Error("Paste the text (or upload a Word / text file) to read the questions from.");
  const n = await tx(async (c) => {
    await c.query("DELETE FROM qp_questions WHERE paper_id = $1", [pid]);
    return insertQuestions(c, pid, text);
  });
  if (file) await q("UPDATE qp_papers SET file_name=$1, file_type=$2, file_data=$3 WHERE id=$4", [file.name, file.type, file.data, pid]);
  refresh(pid);
  return n ? `${n} questions read.` : "No numbered questions were found – check that each question starts with its number (1. 2. 3. or Q1, Q2 …).";
});

export const saveQuestion = action(async (fd) => {
  await manager();
  const pid = id(fd, "paper_id");
  await draftOnly(pid);
  const body = str(fd, "body", 20000);
  if (!body) throw new Error("A question can't be empty – use Delete to remove it.");
  const fields = [str(fd, "section", 300), str(fd, "label", 20), body, str(fd, "marks", 20)];
  const qid = Number(fd.get("id"));
  if (qid > 0) {
    await q("UPDATE qp_questions SET section=$1, label=$2, body=$3, marks=$4 WHERE id=$5 AND paper_id=$6", [...fields, qid, pid]);
  } else {
    const last = await q1<{ m: number }>("SELECT COALESCE(MAX(sort_order), 0) AS m FROM qp_questions WHERE paper_id = $1", [pid]);
    await q("INSERT INTO qp_questions (paper_id, sort_order, section, label, body, marks) VALUES ($1, $2, $3, $4, $5, $6)", [pid, (last?.m ?? 0) + 10, ...fields]);
  }
  refresh(pid);
  return qid > 0 ? "Question saved." : "Question added.";
});

export const deleteQuestion = action(async (fd) => {
  await manager();
  const pid = id(fd, "paper_id");
  await draftOnly(pid);
  await q("DELETE FROM qp_questions WHERE id=$1 AND paper_id=$2", [id(fd), pid]);
  refresh(pid);
  return "Question deleted.";
});

export const moveQuestion = action(async (fd) => {
  await manager();
  const pid = id(fd, "paper_id");
  await draftOnly(pid);
  const qs = await getQuestions(pid);
  const i = qs.findIndex((x) => x.id === id(fd));
  const j = i + (fd.get("dir") === "up" ? -1 : 1);
  if (i < 0 || j < 0 || j >= qs.length) return "Already there.";
  [qs[i], qs[j]] = [qs[j], qs[i]];
  await tx(async (c) => {
    for (let k = 0; k < qs.length; k++) await c.query("UPDATE qp_questions SET sort_order=$1 WHERE id=$2", [(k + 1) * 10, qs[k].id]);
  });
  refresh(pid);
  return "Moved.";
});

export const sendForReview = action(async (fd) => {
  await manager();
  const pid = id(fd);
  await draftOnly(pid);
  const reviewers = ids(fd, "reviewer");
  if (!reviewers.length) throw new Error("Tick at least one staff member to review this paper.");
  if (!(await getQuestions(pid)).length) throw new Error("This paper has no questions yet.");
  await tx(async (c) => {
    for (const s of reviewers) await c.query("INSERT INTO qp_reviewers (paper_id, staff_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [pid, s]);
    await c.query("UPDATE qp_papers SET status='in_review', sent_at=now() WHERE id=$1", [pid]);
  });
  await notifyReviewers(pid, reviewers);
  refresh(pid);
  return `Sent to ${reviewers.length} reviewer${reviewers.length > 1 ? "s" : ""}.`;
});

export const deletePaper = action(async (fd) => {
  await manager();
  await q("DELETE FROM qp_papers WHERE id=$1", [id(fd)]);
  refresh();
  redirect("/papers");
});

/* ---------------- Manager: during and after review ---------------- */

export const addReviewers = action(async (fd) => {
  await manager();
  const pid = id(fd);
  const add = ids(fd, "reviewer");
  if (!add.length) throw new Error("Tick someone to add.");
  for (const s of add) await q("INSERT INTO qp_reviewers (paper_id, staff_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [pid, s]);
  await notifyReviewers(pid, add);
  refresh(pid);
  return "Added.";
});

export const removeReviewer = action(async (fd) => {
  await manager();
  const pid = id(fd);
  const sid = id(fd, "staff_id");
  await tx(async (c) => {
    await c.query("DELETE FROM qp_question_reviews WHERE staff_id=$1 AND question_id IN (SELECT id FROM qp_questions WHERE paper_id=$2)", [sid, pid]);
    await c.query("DELETE FROM qp_reviewers WHERE paper_id=$1 AND staff_id=$2", [pid, sid]);
  });
  refresh(pid);
  return "Removed.";
});

/** Lets a reviewer change a review they already submitted. */
export const reopenReview = action(async (fd) => {
  await manager();
  const pid = id(fd);
  await q("UPDATE qp_reviewers SET submitted_at=NULL WHERE paper_id=$1 AND staff_id=$2", [pid, id(fd, "staff_id")]);
  refresh(pid);
  return "They can change their review again.";
});

export const closePaper = action(async (fd) => {
  await manager();
  const pid = id(fd);
  const outcome = fd.get("outcome") === "rejected" ? "rejected" : "final";
  await q("UPDATE qp_papers SET status='closed', outcome=$1, closed_at=now() WHERE id=$2 AND status <> 'draft'", [outcome, pid]);
  refresh(pid);
  return outcome === "final" ? "Marked final – Admin can print it." : "Marked rejected.";
});

export const reopenPaper = action(async (fd) => {
  await manager();
  const pid = id(fd);
  await q("UPDATE qp_papers SET status='in_review', outcome='', closed_at=NULL WHERE id=$1 AND status='closed'", [pid]);
  refresh(pid);
  return "Back in review.";
});

/** Starts version N+1 as a draft (same details and questions, to edit), and retires this one. */
export const makeRevision = action(async (fd) => {
  await manager();
  const pid = id(fd);
  const newId = await tx(async (c) => {
    const r = await c.query<{ id: number }>(
      `INSERT INTO qp_papers (title, class_code, subject, exam, academic_year, max_marks, duration, instructions, note_to_reviewers,
         version, previous_id, file_name, file_type, file_data)
       SELECT title, class_code, subject, exam, academic_year, max_marks, duration, instructions, '', version + 1, id, file_name, file_type, file_data
       FROM qp_papers WHERE id = $1 RETURNING id`,
      [pid],
    );
    const nid = r.rows[0]?.id;
    if (!nid) throw new Error("That paper no longer exists.");
    await c.query(
      "INSERT INTO qp_questions (paper_id, sort_order, section, label, body, marks) SELECT $1, sort_order, section, label, body, marks FROM qp_questions WHERE paper_id = $2",
      [nid, pid],
    );
    await c.query("UPDATE qp_papers SET status='closed', outcome='revised', closed_at=COALESCE(closed_at, now()) WHERE id=$1", [pid]);
    return nid;
  });
  refresh(pid);
  redirect(`/papers/${newId}?revision=1`);
});

/* ---------------- Staff: review ---------------- */

const REASONS: Reason[] = ["too_many_changes", "fundamental"];

/**
 * A teacher's review. Every question is OK unless they flag it "Needs change" (with what to change).
 * Approve becomes "Approved with changes" by itself when anything is flagged; Disapprove needs a reason and a comment.
 */
export const saveReview = action(async (fd) => {
  const me = await requireActor("staff");
  if (!me.staffId) throw new Error("Sign in with your own staff login to review papers.");
  const pid = id(fd);
  const intent = String(fd.get("intent") ?? "save");
  const p = await getPaper(pid);
  const mine = await q1<{ submitted_at: string | null }>("SELECT submitted_at::text FROM qp_reviewers WHERE paper_id=$1 AND staff_id=$2", [pid, me.staffId]);
  if (!p || !mine) throw new Error("This paper isn't assigned to you.");
  if (p.status !== "in_review") throw new Error("This paper is no longer open for review.");
  if (mine.submitted_at) throw new Error("You have already sent your decision. Ask the Manager if you need to change it.");

  const questions = await getQuestions(pid);
  const verdicts = questions.map((qn) => ({
    qn,
    verdict: fd.get(`verdict_${qn.id}`) === "change" ? ("change" as const) : ("ok" as const),
    comment: str(fd, `comment_${qn.id}`, 5000),
  }));
  const changes = verdicts.filter((x) => x.verdict === "change");
  const comment = str(fd, "overall_comment", 10000);
  const reasonRaw = String(fd.get("reason") ?? "") as Reason;
  const reason: Reason = REASONS.includes(reasonRaw) ? reasonRaw : "";

  let decision: Decision = "";
  if (intent === "approve" || intent === "disapprove") {
    const noNote = changes.filter((x) => !x.comment);
    if (noNote.length) throw new Error(`Write what should change for ${noNote.slice(0, 8).map((x) => `Q${x.qn.label || "?"}`).join(", ")}.`);
    if (intent === "approve") decision = changes.length ? "approved_with_changes" : "approved";
    else {
      if (!reason) throw new Error("Choose why you disapprove the paper.");
      if (!comment) throw new Error("Write a short comment explaining what is wrong.");
      decision = "disapproved";
    }
  }
  const submit = decision !== "";

  await tx(async (c) => {
    for (const x of verdicts) {
      await c.query(
        `INSERT INTO qp_question_reviews (question_id, staff_id, verdict, comment) VALUES ($1, $2, $3, $4)
         ON CONFLICT (question_id, staff_id) DO UPDATE SET verdict = EXCLUDED.verdict, comment = EXCLUDED.comment`,
        [x.qn.id, me.staffId, x.verdict, x.comment],
      );
    }
    await c.query(
      `UPDATE qp_reviewers SET decision=$1, reason=$2, comment=$3, saved_at=now(), submitted_at=CASE WHEN $4 THEN now() ELSE NULL END
       WHERE paper_id=$5 AND staff_id=$6`,
      [decision, decision === "disapproved" ? reason : "", comment, submit, pid, me.staffId],
    );
  });
  refresh(pid);
  if (submit) {
    // Last review in: the Manager can decide.
    const left = await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM qp_reviewers WHERE paper_id = $1 AND submitted_at IS NULL", [pid]);
    if (left?.n === 0) {
      sendMail({
        to: managerEmails(),
        subject: `All reviews in: Class ${p.class_code} ${p.subject} ${p.exam}`.trim(),
        text: `Every teacher has reviewed the Class ${p.class_code} ${p.subject} ${p.exam} paper. Open it to mark it final, make a revised version, or reject it.`,
        link: portalLink(`/papers/${pid}`),
      });
    }
  }
  if (!submit) return "Saved – you can finish later.";
  return decision === "approved" ? "Approved. Thank you!" : decision === "approved_with_changes" ? `Approved with ${changes.length} change${changes.length > 1 ? "s" : ""}. Thank you!` : "Disapproval sent to the Manager.";
});

/** The portal's own address for links in emails: PORTAL_URL, or the Vercel production address. */
function portalLink(path: string) {
  const base = (process.env.PORTAL_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/+$/, "");
  return base ? base + path : undefined;
}

/** Each teacher a paper was just sent to gets an email with a link straight to it. */
async function notifyReviewers(paperId: number, staffIds: number[]) {
  if (!staffIds.length) return;
  const p = await getPaper(paperId);
  if (!p) return;
  const people = await q<{ name: string; email: string }>("SELECT name, email FROM staff_accounts WHERE id = ANY($1::int[]) AND active AND email <> ''", [staffIds]);
  for (const r of people) {
    sendMail({
      to: r.email,
      subject: `Question paper to review: Class ${p.class_code} ${p.subject} ${p.exam}`.trim(),
      text: [
        `Dear ${r.name},`,
        "",
        `The Class ${p.class_code} ${p.subject} ${p.exam} question paper is ready for your review.`,
        "Mark any question that needs a change, then approve or disapprove.",
        ...(p.note_to_reviewers ? ["", `Note from the Manager: ${p.note_to_reviewers}`] : []),
      ].join("\n"),
      link: portalLink(`/papers/${paperId}`),
    });
  }
}
