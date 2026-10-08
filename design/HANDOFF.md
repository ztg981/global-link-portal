# Global Link Portal — design foundation (v0.1 prototype)

Prototype: `Global Link App.dc.html` (one file, all screens). Styling uses the bound Global Link design system (`_ds/…/styles.css` tokens `--gl-*`, components on `window.GlobalLinkUI`). Icons: Lucide via `gl-icon.js` (`<GLIcon n="bell" s="18" fill?>`). All data is fictional and lives in component state; everything below marked **BACKEND** must be built for real.

## Accounts and sign-in
- One account shared with globallink.com (sign up there, sign in here). Username **or** email + password, plus WeChat and Google buttons.
- Roles: `student`, `tutor` (mentor), `parent` (listed in admin People only), `admin`.
- Admin sign-in: username **Admin718**; the password is set on the server (ADMIN_PASSWORD_HASH) and is not stored in this repository. Display name Jordan Reyes. ⚠️ The prototype checks this client-side. **BACKEND:** move to the auth server, hash the password, add 2FA for admin, and never ship credentials in the client bundle.
- Example accounts (Mia / Emma / new student / new mentor) live only in Admin → Developer. Hide that page in production builds.

## Flow
Sign in → sync screen → first-run **Welcome setup** (welcome, language, look and feel, mentor requests, availability painter, reminders, done) → optional **guided tour** (spotlight + Lumi tooltip, `data-tour="…"` anchors; includes a Progress / SAT step) → app. Unfinished items live in the **setup checklist** (bottom-left), which re-opens on every sign-in until complete or hidden. Admins skip onboarding.

## Shell
- Title bar 46px: brand, ⌘K/Ctrl K palette, EN/中文 pill (expands on hover for theme), notifications, avatar menu.
- Sidebar 236px / 68px collapsed, springy active indicator (blue; gold for admin), blue count badge + red overdue badge, next-lesson card, checklist, profile row with animated settings gear (Settings is not a nav item).
- Platform prop: `web`, `electron-mac` (~70px for traffic lights, `titleBarStyle:'hiddenInset'`), `electron-win` (~138px, `titleBarOverlay`). Title bar `-webkit-app-region: drag`.
- Text size: CSS `zoom` on root (80–130%). In Electron prefer `webFrame.setZoomFactor`.

## Screens
**Student:** Home, My mentors (current / past, re-request), Schedule, Classes (recap, transcript, words, tasks, full-screen recap, transcript privacy switch), Tasks (own tasks, share with mentors), Materials (All / Assigned / Progress; deep-link highlights from tasks and messages), Messages (translate, material attachments, Ask any mentor entry), Community, Progress (Overview + SAT tracker; ACT / AP / IELTS locked previews), AI Practice (placeholder + Lumi), Settings.
**Mentor:** Today, Schedule, Students, Questions, Materials (library by plan pack, assign to eligible students, Assigned tab, templates, **material builder**, share with Global Link for review), Messages, Community, Availability.
**Admin:** Overview, People (view-as, suspend, credits, role, notes), Matching, Lessons, **Materials studio** (presets, library, review queue, drafts, archive), Payments (*to be built*), Moderation, Announcements, System (feature switches, maintenance banner, versions, connections), Audit log, Developer.
**Lesson room:** pre-join, live (captions EN+中文, reactions, word card + quiz popups, chat / words / notes, slide share), end (recap, mentor sticky-note feedback).

## BACKEND — what Claude Code needs to build (not possible in the prototype)
**Auth and accounts**
- Shared auth with globallink.com (sessions/JWT, refresh, "keep me signed in"), username or email login, password reset email.
- WeChat OAuth (open platform, QR on desktop) and Google OAuth; account linking.
- Role-based access control enforced server-side (student / mentor / parent / admin); admin "view as" = impersonation with audit trail and read-only option.
- Suspend / restore blocks sign-in and revokes sessions.

**Scheduling and lessons**
- Lessons, bookings, reschedules, cancellations with lesson-credit ledger (per plan pack); time zones stored in UTC with DST handling (Beijing vs California offset changes Nov / Mar).
- Mentor availability (weekly grid) → bookable slots; conflict checks.
- Real video lessons (e.g., LiveKit / Agora / Daily — must work in mainland China), recording, server-side transcription + bilingual captions, recap generation (summary, words, chapters), transcript opt-out honored automatically.
- Reminders: push, email, WeChat template messages; Electron native notifications and tray.

**Content and learning**
- Materials storage (files to object storage/CDN reachable in China), plan-pack entitlement checks on every open.
- Material builder documents (block JSON: heading, text, question, word card, speaking prompt, media) with versioning, drafts, review workflow (mentor → In review → Published / Changes requested), admin archive.
- Assignments (material → students, due date, note, optional task), open/progress tracking, overdue computation, reminder sends.
- Tasks (mentor-assigned and student-made), sharing to mentors, links to materials (highlight by id via deep link).
- Test-prep tracker: SAT (dates, scores per section, goals, practice tests, skill mastery from question-level results); same schema extendable to ACT / AP / IELTS. Entitlement = purchased pack.
- Question-level scoring for SAT sets; skill tagging per question.
- Voice-note and video reply recording/upload (Tasks, Ask a mentor).

**Communication**
- Real-time messaging (WebSocket), read receipts, typing, attachments (materials), parent accounts in threads.
- Translation API for messages / posts / comments (EN↔简体中文), cached per message.
- Ask a mentor: questions, text/video replies, 72-hour SLA with credit refund job.
- Community: posts, comments, likes, saves, groups, events + RSVP, reports, auto-hide rules, link blocking, first-post approval.
- Announcements by audience (all / students / mentors), dismiss state per user; maintenance banner.

**Admin and ops**
- Matching queue with fit scoring (subject, availability overlap, level), assign / decline notifications.
- Payments (*to be built*): WeChat Pay, Alipay, refunds, mentor payouts (USD), plan catalog and pricing.
- Feature flags (Community, Lumi, translation, Ask, AI Practice, sign-ups) served from config.
- Audit log of every admin action (who, what, when, before/after).
- App versions + force update (Electron auto-updater), web cache-busting.
- Analytics for overview numbers and material usage.

**AI**
- Lumi chat and AI Practice: LLM endpoint with student context (saved words, weak SAT skills), safety filtering, usage limits. The prototype calls `window.claude.complete` when available.

## Reusable patterns
Sticky notes (expand to modal), toggle rows, pill tab groups, progress rings, steppers, scrim modals, slide-in drawers, toasts, highlight pulse (`glHl`), locked preview (grayscale + blur + overlay card). Motion: `gl-rise`, `glPageIn`, `glModal`, spring easing `var(--gl-ease-spring)`; disabled by Reduce motion / `prefers-reduced-motion`.

## Storage (prototype only)
`glPortal:prefs` and `glPortal:<role>` in localStorage. In production these come from the shared account backend.
