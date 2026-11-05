# Bharath Dass School – School portal

One web address for all the school systems, on the school's letterhead, with a different home page for each role:

| Login | Sees |
| --- | --- |
| **manager** | Everything: fee collection, trip and shop profit/loss, staff tour money, leave waiting for approval, who is on leave, and full access (admin) inside the office and leave apps. Uploads question papers and sees every teacher's review. Makes the staff logins. |
| **admin** | Data entry everywhere – excursion payments and rosters, trip details and expenses, shop sales/stock/costs, staff tours, leave entries, payslip uploads – but **no totals, dashboards or profit figures**. Views and prints question papers. |
| **staff** | Apply for leave and see their own leave balance (the leave app asks for their own leave login). |
| **a teacher's own login** (made by the Manager on *Staff logins*) | Everything *staff* gets, plus the **question papers sent to them for review**. |

For the office and leave systems the portal doesn't copy any data: buttons open the real apps, already signed in with
the right role, and the Manager's figures are read live from each app. **Question papers live in the portal itself**
(its own database) – they are written in Claude and uploaded here.

## Question papers

1. **Manager → Upload a paper**: paste what Claude wrote (or upload its Word file). Class, subject, exam, year, marks,
   time and general instructions are read from the paper's heading; each question is read by its number (`1.`, `2)`,
   `Q3` …) with *Section / Part* headings and marks like `[2]` or `(2 marks)`.
   - **Upload & send to teachers** sends it straight to the teachers whose subject and class match (Staff page;
     short forms like *Maths* = *Mathematics* are understood).
   - **Upload & check first** opens the questions to edit before sending.
2. **Teachers** sign in with their own login. Every question counts as OK; they tick **Needs change** only where
   something should change and say what, then press **Approve** (sent as *Approved with changes* if anything is
   flagged) or **Disapprove** with a reason – *too many changes to go ahead* or *something fundamentally wrong* – and a
   comment. *Save for later* keeps their work; once sent only the Manager can reopen it.
3. **Manager** sees every decision and every note under each question (the home page lists papers with all reviews
   in), then **Mark final**, **Make a revised version** (same questions as version 2, sent again to the same
   teachers), or **Reject**.
4. **Admin** sees every paper that has been sent out and prints it on the school letterhead (or opens the original file).

Inside the office and leave apps the portal shows up as two users on **Admin → Users**: `portal-manager` (admin) and `portal-admin`
(editor, data entry only). Every entry made through the portal is recorded as *Manager* or *Admin (office)*.
Switching one of these users off in an app blocks portal access to that app.

## Passwords

For now the passwords are the same as the usernames (`manager` / `manager`, `admin` / `admin`, `staff` / `staff`).
To change them, set these in Vercel → this project → Settings → Environment Variables, then redeploy:
`PORTAL_PASSWORD_MANAGER`, `PORTAL_PASSWORD_ADMIN`, `PORTAL_PASSWORD_STAFF`.

## Setting up on Vercel (one-time)

1. Make a long random key (e.g. `openssl rand -base64 48`). This is `PORTAL_SECRET`.
2. **Add New → Project**, import `bharathdassschool/dashboard`, keep the detected *Next.js* settings.
3. In this project open **Storage → Create Database → Neon (Postgres)** (free plan, Singapore / Mumbai) and connect it.
   This adds `DATABASE_URL` (question papers and staff logins are kept there; tables are created automatically).
4. In this project's **Settings → Environment Variables** add:
   - `PORTAL_SECRET` – the key from step 1
   - `OFFICE_URL` – the office app's address, e.g. `https://bharathdass-internal.vercel.app`
   - `LEAVE_URL` – the leave app's address
5. In the **office and leave projects** add `PORTAL_SECRET` with **the same value**, then redeploy them.
6. Redeploy the portal, sign in as `manager`, and add the teachers under **Staff logins**.

Without `PORTAL_SECRET` the office and leave apps behave exactly as before; their portal links simply don't exist.

## Local development

```bash
npm install
DATABASE_URL=postgres://... PORTAL_SECRET=... OFFICE_URL=http://localhost:3001 LEAVE_URL=http://localhost:3002 npm run dev
```

`npm run lint` type-checks; `npm run build` makes a production build.

## How it works

- `/login` checks the three accounts and sets a signed 12-hour cookie.
- `/go/<app>?to=/page` makes a one-minute signed pass for that app and sends the browser to the app's `/portal-login`,
  which checks the pass (signed with `PORTAL_SECRET`, addressed to that app) and signs in as `portal-manager` or `portal-admin`.
- The Manager page calls each app's `/api/portal/summary` with a one-minute signed pass and shows the figures.
