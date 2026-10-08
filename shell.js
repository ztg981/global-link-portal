// App shell glue that sits outside the design:
//  - desktop app (Electron) bridge: window.glDesktop comes from desktop/preload.cjs
//  - home-screen web app: standalone flag, theme-coloured system bars, service worker
//  - Enter submits the sign-in form
(function () {
  'use strict';
  var root = document.documentElement;
  var d = window.glDesktop;
  // window.glApp: shell state the app script reads (the bridge object itself is read-only).
  var glApp = window.glApp = { desktop: !!d, platformProp: 'web', version: '' };
  if (d) {
    // The design's title bar leaves room for the macOS traffic lights / Windows controls.
    glApp.platformProp = d.platform === 'darwin' ? 'electron-mac' : d.platform === 'win32' ? 'electron-win' : 'web';
    root.setAttribute('data-desktop', d.platform);
    d.info().then(function (i) { glApp.version = i.version; }).catch(function () {});
    // A downloaded update: a small banner offers to restart now (otherwise it installs on quit).
    d.onUpdate('ready', function (info) { banner('Global Link ' + info.version + ' is ready.', 'Restart now', function () { d.installUpdate(); }); });
  }
  function banner(text, action, fn) {
    var old = document.getElementById('gl-update'); if (old) old.remove();
    var b = document.createElement('div'); b.id = 'gl-update'; b.setAttribute('role', 'status');
    b.innerHTML = '<span></span><button type="button"></button><button type="button" aria-label="Dismiss">×</button>';
    b.children[0].textContent = text; b.children[1].textContent = action;
    b.children[1].onclick = fn; b.children[2].onclick = function () { b.remove(); };
    document.body.appendChild(b);
  }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) root.setAttribute('data-standalone', '1');
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) root.setAttribute('data-ios', '1');

  // Keep the browser/OS bars the same colour as the app (light, dark or sign-in navy),
  // so iOS never paints a mismatched strip under the home indicator.
  var meta = document.querySelector('meta[name="theme-color"]');
  function paint() {
    var app = document.querySelector('[data-rm]');
    if (!app) return;
    var signin = !!document.querySelector('[data-screen-label="Sign in"]');
    var dark = app.getAttribute('data-theme') === 'dark';
    var c = signin ? '#0c1730' : dark ? '#0f1d3a' : '#f6faff';
    if (meta && meta.content !== c) meta.content = c;
    if (root.style.background !== c) { root.style.background = c; document.body.style.background = c; }
    root.setAttribute('data-scheme', dark ? 'dark' : 'light');
    var mode = signin ? 'signin' : dark ? 'dark' : 'light';
    if (d && paint.mode !== mode) { paint.mode = mode; try { d.setTheme(mode); } catch (e) {} }
  }
  new MutationObserver(function () { clearTimeout(paint.t); paint.t = setTimeout(paint, 50); }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-theme'] });

  // Enter in the sign-in fields submits (the design's form has no <form>).
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target || e.target.tagName !== 'INPUT') return;
    var screen = e.target.closest('[data-screen-label="Sign in"]');
    if (!screen) return;
    var btn = Array.prototype.filter.call(screen.querySelectorAll('button'), function (b) { return /^\s*Sign in\s*$/.test(b.textContent); })[0];
    if (btn) { e.preventDefault(); btn.click(); }
  });

  // Installable web app + offline shell. Not inside the desktop app (it has its own updater).
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !d) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
})();
