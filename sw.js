// Service worker: makes the portal installable and fast on repeat visits.
// - App shell (HTML) is network-first, so updates show up right away; the cached
//   copy is only used offline.
// - Static files (vendor, design system, icons, images) are cache-first.
// - /api is never cached (it carries personal data).
const VERSION = 'gl-portal-v3';
const SHELL = ['/', '/index.html', '/support.js', '/live.js', '/shell.js', '/shell.css', '/config.js', '/gl-icon.js', '/vendor/resources.js',
  '/vendor/react-18.3.1/react.production.min.js', '/vendor/react-18.3.1/react-dom.production.min.js',
  '/_ds/global-link-4f8ca963-88b7-4790-8eff-955934ef565b/styles.css', '/_ds/global-link-4f8ca963-88b7-4790-8eff-955934ef565b/_ds_bundle.css',
  '/_ds/global-link-4f8ca963-88b7-4790-8eff-955934ef565b/_ds_bundle.js', '/assets/gl-mark.png', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/download')) return;
  const isPage = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  const isCode = /\.(js|css|webmanifest)$/.test(url.pathname) && !url.pathname.startsWith('/vendor/');
  if (isPage || isCode) {
    // Network first: always the newest app when online.
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(isPage ? '/index.html' : req, copy)); } return res; })
      .catch(() => caches.match(isPage ? '/index.html' : req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
});

// Push: lesson reminders, new messages, payments. Payload is { title, body, url, tag }.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Global Link', { body: d.body || '', tag: d.tag || undefined, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let url = '/';
  try { const u = new URL((e.notification.data && e.notification.data.url) || '/', location.origin); if (u.origin === location.origin) url = u.href; } catch (err) {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    if (open) return open.focus();
    return self.clients.openWindow(url);
  }));
});
