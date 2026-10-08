# Security

Report problems privately to the Global Link team (support@globallink.com), not in public issues.

## Secrets
- No keys, passwords or connection strings in this repository. They live in Vercel
  environment variables (and a git-ignored `.env.local` for development).
  `npm run security:scan` (also run in CI) fails on anything secret-looking.
- The admin password is checked on the server against scrypt hashes in
  `ADMIN_PASSWORD_HASH`. Optional TOTP two-step sign-in with `ADMIN_TOTP_SECRET`.
  Bump `ADMIN_TOKEN_VERSION` to sign every admin session out.
- AI keys are only used server-side. Fallback models are limited to free OpenRouter
  models unless `ALLOW_PAID_MODELS=1`.

## Accounts and access
- Passwords: scrypt (N=16384, r=8, p=1). JWTs: HS256 with a 32+ character secret
  shared with the website. A password change or suspension bumps `token_version`,
  which signs the person out of both apps.
- Every portal query is scoped to the caller. Students and mentors only reach people
  they are matched with (messages, tasks, assignments, booking). The admin API
  requires an admin token. "View as" tokens are read-only and expire in 30 minutes.
- Portal-only tokens (admin, view-as) are rejected by the website.
- Rate limits are stored in the database: sign-in failures (per account and per
  network), messages, mentor requests, questions, posts, comments, Lumi (per minute,
  per day, site-wide) and translation.
- All SQL is parameterized. Inputs are length-limited, material blocks are
  allow-listed, and saved preferences only accept known keys.
- Google sign-in uses a random `state` in an HttpOnly, SameSite=Lax cookie and only
  signs in existing accounts with a verified Google email. The app gets a one-time
  code (single use, 2 minutes), never a token in a URL.
- Uploads: authenticated, rate-limited, max 4 MB, content-type allow-list, random
  file names. Messages, answers and materials only accept file URLs on our own
  Vercel Blob store.
- Payments: credits change only through a ledger (`portal_credit_events`) that
  can't go below zero. Stripe sessions and webhook events are re-read from Stripe
  before any credit is added, and each payment is settled once.

## Web
- Content-Security-Policy (no third-party scripts; React, icons and the design system
  are self-hosted), HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, COOP,
  nosniff, strict referrer policy, Permissions-Policy (camera/microphone only for
  this site). `/api` responses are `no-store`.
- The service worker never caches `/api`. Notification clicks only open this site.
- Tokens are kept in localStorage ("keep me signed in") or sessionStorage.

## Desktop app
- `contextIsolation`, `sandbox`, no `nodeIntegration`; the preload exposes a small
  fixed API (`window.glDesktop`).
- The window can only navigate within the app's origin; other links open in the
  default browser. Pop-ups are denied.
- Only the app's origin may request notifications and camera/microphone.
- The `globallink://` link only accepts `globallink://oauth/<one-time code>`.
- Updates come from this repository's GitHub Releases over HTTPS (electron-updater
  checks the published SHA-512).

## Known limits
- macOS builds are ad-hoc signed until an Apple Developer ID is added, and Windows
  builds are unsigned (SmartScreen shows a warning the first time).
- Live video, WeChat sign-in and paying with WeChat Pay/Alipay inside the app are
  not built yet. Sending email to anyone but the account owner needs a verified
  domain in Resend.
