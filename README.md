# Global Link app (portal)

The Global Link app for students, mentors and the Global Link team: lessons,
mentors, schedule, tasks, materials, messages, community, progress, Lumi (AI
helper) and the admin console. One codebase runs as:

| Where | How |
|---|---|
| **Web** | https://global-link-portal.vercel.app |
| **Windows / macOS** | Desktop app (Electron) in [`desktop/`](desktop), installers on [Releases](https://github.com/ztg981/global-link-portal/releases/latest), auto-updates |
| **iPhone / Android** | Open the web app, then Share → **Add to Home Screen** (installable web app with offline shell) |

It works together with the public website, **globallink.com**
([ztg981/global-link-club](https://github.com/ztg981/global-link-club)):
people **sign up on the website and sign in here** with the same username or
email and password. Both apps use the same Neon Postgres database and the same
`AUTH_SECRET`, so accounts, mentor requests and bookings made on the website
show up in the app, and suspending someone in the admin console signs them out
of both.

```
 globallink.com (global-link-club)          Global Link app (this repo)
 ┌──────────────────────────────┐          ┌──────────────────────────────────┐
 │ marketing site, sign-up,     │          │ index.html (Claude Design app)    │
 │ bookings, mentor requests,   │          │ + live.js (API client)            │
 │ password reset, Lumi chat    │          │ + shell.js/css (phone, desktop)   │
 │ /api/auth/*  /api/submit ... │          │ /api/auth/*  /api/portal/*        │
 └──────────────┬───────────────┘          │ /api/admin/*  /api/health         │
                │   same AUTH_SECRET (JWT)  └───────────────┬──────────────────┘
                └──────────────┬────────────────────────────┘
                     Neon Postgres: users, submissions (requests, bookings),
                     parent_links, … + portal_* tables (db/schema.sql)
```

## The design and how this app is built from it

`design/Global Link App.dc.html` is the Claude Design export, kept as-is
(plus `design/HANDOFF.md`). `index.html` is **generated** from it:

```bash
npm run build:app    # node scripts/build-app.mjs
```

The build keeps the design 1:1 and only adds what a real app needs. Every patch
must match the design exactly, so a changed export fails loudly.

- **Two data modes.** The design's sample data (Mia, Emma, the admin's sample
  numbers) is kept as the **demo**. The admin opens the sample accounts from
  **Admin → Developer** to show what a full account looks like. Real accounts
  (**live**) load their own data from the API and start empty, with empty states
  instead of sample lessons, messages, posts or mentors.
- `scripts/patches-script.mjs`, `scripts/live-methods.mjs`: logic hooks (API
  calls, live data, sign-in).
- `scripts/live-screens*.mjs`: live versions of screens whose markup had the
  sample people typed in, plus empty states.
- `live.js`: API client and the mapping from API data to the design's data shapes.
- `shell.js` / `shell.css`: phone layout (bottom tab bar, safe areas), installable
  web app, desktop bridge, update banner.

After editing the design in Claude Design, export it to `design/` and run
`npm run build:app`. CI checks that `index.html` matches the export.

## Run locally

```bash
npm install
cp .env.example .env.local     # add your own keys; never commit them
npm run build:app
PGLITE_DIR=.pglite node scripts/seed-dev.mjs   # test_student / test_mentor, password: password123
npm run dev                    # http://localhost:3124
```

Without `DATABASE_URL` the API uses an in-process Postgres (PGlite), so there is
one code path for local dev and production.

Admin console: sign in with `ADMIN_USERNAME` and the password whose hash is in
`ADMIN_PASSWORD_HASH` (make one with `node scripts/hash-password.mjs "password"`).

## Tests

```bash
npm test               # API end to end + every screen rendered for demo, empty and real accounts
npm run security:scan  # no secrets in files git would publish
```

## Deploy (Vercel)

Vercel project root = this repo. Set the environment variables from
[`.env.example`](.env.example). `DATABASE_URL` and `AUTH_SECRET` **must equal the
website's**. Functions: `api/auth/[action]`, `api/portal/[action]`,
`api/admin/[action]`, `api/cron`, `api/stripe`, `api/health`. Security headers and download redirects
(`/download/windows`, `/download/mac`, `/download/mac-intel`) are in `vercel.json`.

**Scheduled jobs** (`/api/cron`, needs `CRON_SECRET`): lesson reminders a day and
15 minutes ahead, marking finished lessons done, expiring unanswered questions
after 72 hours (the credit goes back) and stale payment requests after 14 days.
Vercel runs it daily; [`.github/workflows/cron.yml`](.github/workflows/cron.yml)
runs it every 10 minutes (repository secret `CRON_SECRET`).

**Optional services** (each switches itself on when its variables are set):

| Feature | Variables |
|---|---|
| Google sign-in (web and desktop) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; redirect URI `https://<app>/api/auth/google-callback` |
| Push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Email (reminders, replies, payments) | `RESEND_API_KEY`, `EMAIL_FROM` |
| Card payments in the app | `STRIPE_SECRET_KEY` (test or live key); webhook URL `/api/stripe` (optional, checkout also settles on return) |
| WeChat payments (confirmed by the team) | optional `WECHAT_PAY_ID` (shown to families) |
| Uploads (voice notes, video replies, files) | `BLOB_READ_WRITE_TOKEN` (Vercel Blob) |
| Mentor payouts | optional `PAYOUT_USD_PER_LESSON` (default 20) |

## Desktop app

[`desktop/`](desktop): Electron shell that shows the hosted app, with native
window buttons, tray, notifications, unread badge and an offline screen.
Sandboxed, context-isolated, no Node in the page, navigation locked to the app's
origin; see [SECURITY.md](SECURITY.md).

**Release:** bump `desktop/package.json` `version`, then
`git tag v0.1.2 && git push origin v0.1.2`. GitHub Actions builds the Windows
installer and the macOS DMGs/ZIPs (Apple silicon and Intel) and publishes them to
a GitHub Release with `latest.yml` / `latest-mac.yml`.

- **Windows:** installed apps download updates in the background and install
  them on restart (a banner offers "Restart now").
- **macOS:** builds are ad-hoc signed. Until there is an Apple Developer ID, the
  first launch needs **System Settings → Privacy & Security → Open Anyway**, and
  updates are offered as a download (macOS only lets signed apps replace
  themselves).

Stable download links (used by the website):
`https://github.com/ztg981/global-link-portal/releases/latest/download/Global-Link-Setup.exe`,
`…/Global-Link-mac-arm64.dmg`, `…/Global-Link-mac-x64.dmg`.

## Lumi (AI)

`/api/portal/lumi` and `/api/portal/translate` use a provider waterfall
(`api/_lib/llm.js`): every Gemini key on **Gemini 3.5 Flash**, then
**Flash-Lite**, then **OpenRouter free models** (`:free` only, so a fallback can
never spend money). On error, timeout or an empty reply it moves to the next
one. Limits are per user and site-wide. Keys live only in environment variables.

## What is real and what is still a preview

**Real:** accounts shared with the website; mentor requests → admin matching
(with fit scores) → the mentor accepts; messages (mentors, students, the
Global Link team; team messages also reach the website's team inbox);
booking from a mentor's weekly hours, with time-zone and double-booking checks;
cancel; reschedule requests; .ics calendar files; tasks; Ask a mentor (text
replies); materials (builder, review, publish, assign, progress); community
posts, comments, likes, reports, auto-hide and link blocking; announcements,
maintenance banner, feature switches and remote reload; admin People (suspend,
credits, role, notes, password-reset links, read-only "view as"), audit log;
preferences, onboarding, SAT tracker and saved words synced to the account;
Lumi and translation; Google sign-in (website and app, including the desktop
app through a `globallink://` link); lesson credits (a free intro lesson, one
credit per booking, refunded on early cancellation); buying lessons (WeChat
request confirmed by the team, or Stripe checkout); admin Payments (confirm,
record, refund, mentor payouts); community events with RSVPs and join links;
voice-note tasks, video replies and file attachments (Vercel Blob, 4 MB);
the material viewer with quizzes and progress; the AI Practice path; push and
email notifications; lesson reminders.

**Preview / to be built:** live video (the lesson room is kept as designed and
labelled a preview, ready for LiveKit/Agora/Zoom), lesson recordings,
transcripts and recaps, WeChat sign-in, and paying with WeChat Pay/Alipay inside
the app (families pay on WeChat and the team confirms it).
