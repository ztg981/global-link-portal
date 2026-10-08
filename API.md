# Global Link app API

Base URL: `https://global-link-portal.vercel.app`. JSON in and out; errors are
`{ "error": "message" }`. Authenticated calls send `Authorization: Bearer <token>`.

Tokens are HS256 JWTs signed with `AUTH_SECRET`, **shared with globallink.com**,
so a token from the website's `/api/auth/login` also works here (and the other
way around for normal member tokens). Three kinds:

| Kind | Payload | Works on |
|---|---|---|
| member | `{ sub: users.id, role, tv }` | both apps (`tv` must equal `users.token_version`) |
| admin | `{ sub: "admin", role: "admin", aud: "portal", av }` | this app only, 12 h |
| view-as | `{ sub, role, tv, imp: "admin", ro: true, aud: "portal" }` | this app only, read-only, 30 min |

## Auth — `/api/auth/<action>`

| Method | Action | Body | Returns |
|---|---|---|---|
| POST | `login` | `{ login: email-or-username, password, otp? }` | `{ token, user }`, or `{ needOtp: true }` for admin 2FA; `401`, `403` (suspended / parent), `429` |
| GET | `me` | | `{ user, readOnly }` |
| PATCH | `me` | `{ name?, lang?, timeZone? }` | `{ user }` |
| POST | `password` | `{ current, next }` | `{ token, user }` (signs out other sessions) |
| GET | `providers` | | `{ google, wechat, site }` |
| GET | `google` | `?desktop=1` | Redirects to Google (state cookie) |
| GET | `google-callback` | | Existing account → `/#/oauth/<code>` (desktop: `globallink://oauth/<code>`); else `/#/oauth-error/<why>` |
| POST | `oauth` | `{ code }` | One-time code (2 min) → `{ token, user }` |

Sign-up, password reset and parent accounts are on the website.

## Portal — `/api/portal/<action>` (students and mentors)

| Method | Action | Body | Notes |
|---|---|---|---|
| GET | `bootstrap` | | Everything for the signed-in user (below) |
| GET | `sync` | | Threads and site config, for polling |
| POST | `state` | `{ state: {...} }` | Saves preferences/onboarding/practice (allow-listed keys) |
| POST | `message` | `{ to: userId \| "team", text, mats?, file? }` | Only to matched mentors/students or the team; `file` from `upload` |
| POST | `read` | `{ from: userId \| "team" }` | Marks a thread read |
| POST | `request` | `{ subject, note?, mentorName?, times? }` | Student asks for a mentor (`submissions.type = mentor_request`, same as the website) |
| POST | `cancel-request` | `{ id }` | |
| POST | `respond` | `{ id: matchId, accept }` | Mentor accepts/declines a match |
| POST | `book` | `{ tutorId, start: ms }` | Inside the mentor's hours, ≥30 min ahead, no clashes; uses one credit (`402` when out) |
| POST | `lesson` | `{ id, op: "cancel" \| "feedback", text?, next?, color? }` | |
| POST | `task` | `{ op: "create" \| "done" \| "delete" \| "submit", ... }` | `submit`: `{ id, file }` voice note for a mentor's task |
| POST | `ask` / `answer` | `{ to, q, kind, share }` / `{ id, text, video? }` | Ask a mentor; video replies upload first |
| POST | `upload` | raw body, `?kind=voice\|video\|image\|file\|material&name=&type=&secs=` | `{ url, name, type, size }` (Vercel Blob, max 4 MB, type allow-list) |
| POST | `push-subscribe` / `push-unsubscribe` | Web Push subscription | |
| POST | `buy` | `{ packId, method: "wechat" \| "stripe" }` | WeChat: payment request + team message. Stripe: `{ url }` to Checkout |
| POST | `checkout-status` | `{ sessionId }` | `{ paid }`; credits are added once |
| POST | `rsvp` | `{ id, on }` | Community events |
| POST | `event` | `{ title, kind, start, dur, link?, body? }` | Mentors host events |
| POST | `material` | `{ id?, title, type, pack, level, blocks, status }` | Mentor's own materials; `status: "In review"` sends for review |
| POST | `assign` / `unassign` / `progress` | | Materials to students |
| POST | `post` / `comment` / `like` / `report` | | Community (rules: link blocking, first-post review, hide after 3 reports) |
| POST | `lumi` | `{ messages: [{role, content}] }` | `{ text }`; header `x-llm-provider` |
| POST | `translate` | `{ text }` | `{ text }` (EN ↔ 简体中文) |

`bootstrap` returns `me, state, config, matches, lessons, tasks, questions,
sharedQs, assignments, library, requests, bookings (from the website), grids,
busy, directory, threads, posts, groupCounts, members, events, payments, pkgs,
payInfo, vapid, now`; `me.credits` and `me.packs`.

## Admin — `/api/admin/<action>` (admin token)

| Method | Action | Body |
|---|---|---|
| GET | `data` | Users, matching queue with fit suggestions, lessons, materials, reports, audit, sign-ups, team inbox, config |
| GET | `thread?id=` | Team conversation with one person |
| POST | `user` | `{ id, op: "status" \| "role" \| "credits" \| "note", value }` |
| POST | `view-as` | `{ id }` → read-only token |
| POST | `reset` | `{ id }` → one-hour reset link for the website |
| POST | `match` / `decline-request` | `{ requestId, tutorId }` / `{ requestId }` |
| POST | `lesson` | `{ id, op: "cancel" \| "credit" }` |
| POST | `material` | create/update (Draft/Published/Archived), `{ op: "review", approve }`, `{ op: "status" }` |
| POST | `moderate` | `{ id: postId, op: "keep" \| "warn" \| "remove" }` |
| POST | `config` | `{ key: flags\|maint\|announce\|annHist\|modRules\|pkgs\|reloadAt, value, audit? }` |
| POST | `message` | `{ to, text }`, sent as the Global Link team |
| POST | `payment` | `{ op: "record", userId, packId, amount, note }` \| `{ op: "confirm" \| "cancel" \| "refund", id }` |
| POST | `payout` | `{ tutorId, month }` marks a mentor's month paid |
| POST | `event` | create (`title, kind, start, dur, link, body`) or `{ op: "delete", id }` |

Every admin change is written to `portal_audit`.

## Other

- `GET /api/cron` (`Authorization: Bearer $CRON_SECRET`): reminders, wrap-up, expiry.
- `POST /api/stripe`: Stripe webhook. The event is fetched again from Stripe by id, so a forged body does nothing.

## Health

`GET /api/health` → `{ ok, database, auth, admin, admin2fa, lumi: { links, chain }, version }`. Never shows secrets.
