// Idempotent schema, applied automatically on first database use.
export const SCHEMA: string[] = [
  // Personal staff logins (made by the Manager on the Staff page). Used to send each person the papers they review.
  `CREATE TABLE IF NOT EXISTS staff_accounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    classes TEXT NOT NULL DEFAULT '',
    subjects TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_username ON staff_accounts (lower(username))`,
  // Staff come from the leave system: same login, and their classes and subjects route question papers to them.
  `ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS leave_user_id INT UNIQUE`,
  `ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS designation TEXT NOT NULL DEFAULT ''`,

  // ---------- Question papers (made in Claude, uploaded by the Manager, reviewed by staff) ----------
  // status: draft (Manager still checking) → in_review (sent to reviewers) → closed (Manager finished it).
  `CREATE TABLE IF NOT EXISTS qp_papers (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    class_code TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    max_marks TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    note_to_reviewers TEXT NOT NULL DEFAULT '',
    version INT NOT NULL DEFAULT 1,
    previous_id INT REFERENCES qp_papers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','closed')),
    outcome TEXT NOT NULL DEFAULT '' CHECK (outcome IN ('','final','revised','rejected')),
    file_name TEXT NOT NULL DEFAULT '',
    file_type TEXT NOT NULL DEFAULT '',
    file_data BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS qp_questions (
    id SERIAL PRIMARY KEY,
    paper_id INT NOT NULL REFERENCES qp_papers(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    section TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    marks TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS qp_questions_paper ON qp_questions (paper_id, sort_order)`,
  // One row per reviewer of a paper. decision is empty until they submit their final decision.
  `CREATE TABLE IF NOT EXISTS qp_reviewers (
    paper_id INT NOT NULL REFERENCES qp_papers(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    decision TEXT NOT NULL DEFAULT '' CHECK (decision IN ('','approved','approved_with_changes','disapproved')),
    reason TEXT NOT NULL DEFAULT '' CHECK (reason IN ('','too_many_changes','fundamental')),
    comment TEXT NOT NULL DEFAULT '',
    saved_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    PRIMARY KEY (paper_id, staff_id)
  )`,
  // Each reviewer's verdict on each question: ok, or change (with what to change).
  `CREATE TABLE IF NOT EXISTS qp_question_reviews (
    question_id INT NOT NULL REFERENCES qp_questions(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('ok','change')),
    comment TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (question_id, staff_id)
  )`,
];
