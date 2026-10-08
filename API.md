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

Sign-up, password reset and parent accounts are on the website.

## Portal — `/api/portal/<action>` (students and mentors)

| Method | Action | Body | Notes |
|---|---|---|---|
| GET | `bootstrap` | | Everything for the signed-in user (below) |
| GET | `sync` | | Threads and site config, for polling |
| POST | `state` | `{ state: {...} }` | Saves preferences/onboarding/practice (allow-listed keys) |
| POST | `message` | `{ to: userId \| "team", text, mats? }` | Only to matched mentors/students or the team |
| POST | `read` | `{ from: userId \| "team" }` | Marks a thread read |
| POST | `request` | `{ subject, note?, mentorName?, times? }` | Student asks for a mentor (`submissions.type = mentor_request`, same as the website) |
| POST | `cancel-request` | `{ id }` | |
| POST | `respond` | `{ id: matchId, accept }` | Mentor accepts/declines a match |
| POST | `book` | `{ tutorId, start: ms }` | Inside the mentor's hours, ≥30 min ahead, no clashes |
| POST | `lesson` | `{ id, op: "cancel" \| "feedback", text?, next?, color? }` | |
| POST | `task` | `{ op: "create" \| "done" \| "delete", ... }` | |
| POST | `ask` / `answer` | `{ to, q, kind, share }` / `{ id, text }` | Ask a mentor |
| POST | `material` | `{ id?, title, type, pack, level, blocks, status }` | Mentor's own materials; `status: "In review"` sends for review |
| POST | `assign` / `unassign` / `progress` | | Materials to students |
| POST | `post` / `comment` / `like` / `report` | | Community (rules: link blocking, first-post review, hide after 3 reports) |
| POST | `lumi` | `{ messages: [{role, content}] }` | `{ text }`; header `x-llm-provider` |
| POST | `translate` | `{ text }` | `{ text }` (EN ↔ 简体中文) |

`bootstrap` returns `me, state, config, matches, lessons, tasks, questions,
sharedQs, assignments, library, requests, bookings (from the website), grids,
busy, directory, threads, posts, groupCounts, members, now`.

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

Every admin change is written to `portal_audit`.

## Health

`GET /api/health` → `{ ok, database, auth, admin, admin2fa, lumi: { links, chain }, version }`. Never shows secrets.
