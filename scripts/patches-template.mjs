// Exact-match patches for the design's markup (everything before the script).
// Demo screens are wrapped in {{ DEMO }}; LIVE gets the same layout bound to real data.
import { LIVE_SCREENS } from './live-screens.mjs';
import { MORE_SCREENS_3 } from './live-screens-3.mjs';
const r = String.raw;

const HEAD = r`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Global Link</title>
<meta name="description" content="Your Global Link lessons, mentors and practice, all in one place.">
<meta name="theme-color" content="#0c1730">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Global Link">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>html,body{background:#0c1730}</style>
<link rel="preload" as="script" href="vendor/react-18.3.1/react.production.min.js">
<link rel="preload" as="script" href="vendor/react-18.3.1/react-dom.production.min.js">
<link rel="stylesheet" href="shell.css">
<script src="config.js"></script>
<script src="vendor/resources.js"></script>
<script src="live.js"></script>
<script src="shell.js"></script>
<script src="./support.js"></script>
</head>`;

export const TEMPLATE_PATCHES = [
  [r`<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="./support.js"></script>
</head>`, HEAD],
  // Sign-in: keep-me-signed-in, real links to globallink.com, admin 2FA field, no dev shortcut.
  [r`<input type="checkbox" defaultChecked="{{ true }}" style="accent-color:var(--gl-blue)">`, r`<input type="checkbox" defaultChecked="{{ true }}" onChange="{{ setKeep }}" style="accent-color:var(--gl-blue)">`],
  [r`<a href="#">Forgot password?</a>`, r`<a href="{{ forgotHref }}" target="_blank" rel="noopener">Forgot password?</a>`],
  [r`New to Global Link? <a href="#">Create your account on globallink.com</a>`, r`New to Global Link? <a href="{{ signupHref }}" target="_blank" rel="noopener">Create your account on globallink.com</a>`],
  [r`<x-import component-from-global-scope="GlobalLinkUI.TextField" label="Password" type="password" value="{{ pw }}" onChange="{{ setPw }}" error="{{ signErr }}" hint-size="100%,72px"></x-import>`,
   r`<x-import component-from-global-scope="GlobalLinkUI.TextField" label="Password" type="password" value="{{ pw }}" onChange="{{ setPw }}" error="{{ signErr }}" autoComplete="current-password" hint-size="100%,72px"></x-import>
      <sc-if value="{{ needOtp }}"><x-import component-from-global-scope="GlobalLinkUI.TextField" label="Authenticator code" type="text" value="{{ otp }}" onChange="{{ setOtp }}" autoComplete="one-time-code" hint="Admin accounts use two-step sign-in." hint-size="100%,72px"></x-import></sc-if>`],
  [/\n      <div style="margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:14px;border:1px dashed var\(--gl-blue-soft\);background:var\(--gl-soft\)">\n        <span[^\n]*>DEV<\/span>\n[^\n]*\n[^\n]*asAdminLogin[^\n]*\n      <\/div>/, ''],
  ...LIVE_SCREENS,
  ...MORE_SCREENS_3,
];
