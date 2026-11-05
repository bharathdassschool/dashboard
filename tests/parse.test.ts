// Reading a question paper written by Claude into questions and heading details.
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentAcademicYear, detectDetails, parseQuestions } from "../lib/parse";

const PAPER = `# BHARATH DASS SCHOOL
## Quarterly Examination 2026-27
**Class: VIII    Subject: Science    Max Marks: 50    Time: 1½ hrs**

**General Instructions:**
1. All questions are compulsory.
2. Write neatly.

## Section A – Choose the correct answer
**1.** Which of these is a conductor? [1]
   a) Wood  b) Copper  c) Plastic  d) Rubber
**2.** The unit of force is ______. (1)

## Section B
Q3. Define friction. Give two examples. (2 marks)
Q.4 Explain why the sky appears blue.
(a) What is scattering?
(b) Name the scientist who explained it. – 3 marks

PART – C
5) Draw the human ear and label its parts. [5]`;

test("splits a paper into numbered questions with sections and marks", () => {
  const { questions } = parseQuestions(PAPER);
  assert.deepEqual(questions.map((q) => q.label), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(questions.map((q) => q.marks), ["1", "1", "2", "3", "5"]);
  assert.equal(questions[0].section, "Section A – Choose the correct answer");
  assert.equal(questions[4].section, "PART – C");
  assert.match(questions[0].body, /Copper/); // options stay with their question
  assert.match(questions[3].body, /\(b\) Name the scientist/); // sub-parts stay too
});

test("keeps fill-in-the-blank lines and doesn't treat instructions as questions", () => {
  const { questions } = parseQuestions(PAPER);
  assert.equal(questions[1].body, "The unit of force is ______.");
  assert.ok(!questions.some((q) => /compulsory/.test(q.body)));
});

test("reads class, subject, exam, year, marks, time and instructions from the heading", () => {
  const d = detectDetails(PAPER);
  assert.equal(d.class_code, "VIII");
  assert.equal(d.subject, "Science");
  assert.equal(d.exam, "Quarterly");
  assert.equal(d.academic_year, "2026-27");
  assert.equal(d.max_marks, "50");
  assert.equal(d.duration, "1½ hours");
  assert.match(d.instructions, /All questions are compulsory/);
});

test("reads a table-style heading with numbers for classes", () => {
  const d = detectDetails("HALF YEARLY EXAMINATION – 2026–2027\n| Class: 10 | Subject: Mathematics | Total Marks: 100 | Time Allowed: 3 Hours |\n1. Find the HCF of 24 and 36.");
  assert.equal(d.class_code, "X");
  assert.equal(d.subject, "Mathematics");
  assert.equal(d.exam, "Half Yearly");
  assert.equal(d.max_marks, "100");
});

test("a word starting with 'Part' inside a question is not a section heading", () => {
  const { questions } = parseQuestions("1. Q one\nParty at noon.\n2. Q two");
  assert.equal(questions.length, 2);
  assert.match(questions[0].body, /Party at noon/);
});

test("school year runs June to May", () => {
  assert.equal(currentAcademicYear(new Date("2026-11-05")), "2026-27");
  assert.equal(currentAcademicYear(new Date("2027-04-30")), "2026-27");
  assert.equal(currentAcademicYear(new Date("2027-06-01")), "2027-28");
});
