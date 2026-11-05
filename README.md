# Bharath Dass School – School portal

One web address for all the school systems, with a different home page for each role:

| Login | Sees |
| --- | --- |
| **manager** | Everything: fee collection, trip and shop profit/loss, staff tour money, leave waiting for approval, who is on leave, question papers, and full access (admin) inside every app. |
| **admin** | Data entry everywhere – excursion payments and rosters, trip details and expenses, shop sales/stock/costs, staff tours, leave entries, payslip uploads, question papers – but **no totals, dashboards or profit figures**. |
| **staff** | Apply for leave and see their own leave balance. They sign in to the leave app with **their own staff login** (the shared one can't tell whose leave it is). |

The portal doesn't copy any data. Buttons open the real apps (office, leave, question papers), already signed in with
the right role, and the Manager's figures are read live from each app.

Inside each app the portal shows up as two users on **Admin → Users**: `portal-manager` (admin) and `portal-admin`
(editor, data entry only). Every entry made through the portal is recorded as *Manager* or *Admin (office)*.
Switching one of these users off in an app blocks portal access to that app.

## Passwords

For now the passwords are the same as the usernames (`manager` / `manager`, `admin` / `admin`, `staff` / `staff`).
To change them, set these in Vercel → this project → Settings → Environment Variables, then redeploy:
`PORTAL_PASSWORD_MANAGER`, `PORTAL_PASSWORD_ADMIN`, `PORTAL_PASSWORD_STAFF`.

## Setting up on Vercel (one-time)

1. Make a long random key (e.g. `openssl rand -base64 48`). This is `PORTAL_SECRET`.
2. **Add New → Project**, import `bharathdassschool/dashboard`, keep the detected *Next.js* settings.
3. In this project's **Settings → Environment Variables** add:
   - `PORTAL_SECRET` – the key from step 1
   - `OFFICE_URL` – the office app's address, e.g. `https://bharathdass-internal.vercel.app`
   - `LEAVE_URL` – the leave app's address
   - `PAPERS_URL` – the question-paper app's address
4. In **each of the three apps' projects** add `PORTAL_SECRET` with **the same value**, then redeploy them.
5. Redeploy the portal and sign in.

Without `PORTAL_SECRET` the three apps behave exactly as before; their portal links simply don't exist.

## Local development

```bash
npm install
PORTAL_SECRET=... OFFICE_URL=http://localhost:3001 LEAVE_URL=http://localhost:3002 PAPERS_URL=http://localhost:3003 npm run dev
```

`npm run lint` type-checks; `npm run build` makes a production build.

## How it works

- `/login` checks the three accounts and sets a signed 12-hour cookie.
- `/go/<app>?to=/page` makes a one-minute signed pass for that app and sends the browser to the app's `/portal-login`,
  which checks the pass (signed with `PORTAL_SECRET`, addressed to that app) and signs in as `portal-manager` or `portal-admin`.
- The Manager page calls each app's `/api/portal/summary` with a one-minute signed pass and shows the figures.
