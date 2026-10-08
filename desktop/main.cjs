// Global Link desktop app (Windows and macOS).
//
// The window shows the hosted portal (GL_APP_URL, default the production site),
// so the app always has the newest screens and talks to the API on the same
// origin. The shell itself (window, tray, notifications, auto-update) updates
// from GitHub Releases with electron-updater, like Ligand.
//
// Security: the page runs sandboxed with context isolation and no Node access.
// It can only navigate within the portal's origin; every other link opens in
// the user's browser. Only notifications and camera/microphone (for lessons)
// may be requested, and only by the portal itself.
const { app, BrowserWindow, Menu, Tray, shell, ipcMain, nativeImage, nativeTheme, dialog, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const APP_URL = (process.env.GL_APP_URL || 'https://global-link-portal.vercel.app').replace(/\/$/, '');
const APP_ORIGIN = new URL(APP_URL).origin;
const RELEASES = 'https://github.com/ztg981/global-link-portal/releases/latest';
const isMac = process.platform === 'darwin';
const NAVY = '#0c1730';

app.setName('Global Link');
if (process.platform === 'win32') app.setAppUserModelId('com.globallink.portal');
if (!app.requestSingleInstanceLock()) app.quit();

let win = null, tray = null, quitting = false, keepInTray = false, offline = false;
const startHidden = process.argv.includes('--hidden');

function icon(name) { return path.join(__dirname, 'build', name); }

function show() {
  if (!win || win.isDestroyed()) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 980, minHeight: 640,
    backgroundColor: NAVY, title: 'Global Link', show: false,
    icon: isMac ? undefined : icon('icon.png'),
    // The design draws its own 46px title bar; the OS buttons sit on top of it.
    titleBarStyle: 'hidden',
    trafficLightPosition: isMac ? { x: 16, y: 15 } : undefined,
    titleBarOverlay: isMac ? undefined : { color: '#f6faff', symbolColor: '#4a5b78', height: 46 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: true,
    },
  });
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.on('close', e => { if (!quitting && keepInTray && tray) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' }; });
  wc.on('will-navigate', (e, url) => { if (!sameOrigin(url) && !url.startsWith('file:')) { e.preventDefault(); openOutside(url); } });
  wc.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = aborted (normal during redirects)
    offline = true;
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: APP_URL } });
  });
  load();
  // Smoke test (CI / local): GL_SMOKE_SHOT=out.png saves a screenshot after load and quits.
  if (process.env.GL_SMOKE_SHOT) wc.once('did-finish-load', () => setTimeout(async () => {
    const img = await wc.capturePage();
    require('fs').writeFileSync(process.env.GL_SMOKE_SHOT, img.toPNG());
    const title = await wc.executeJavaScript('JSON.stringify({t:document.title,desktop:document.documentElement.getAttribute("data-desktop"),glApp:window.glApp,bridge:typeof window.glDesktop,node:typeof require})');
    console.log('SMOKE', title);
    quitting = true; app.quit();
  }, Number(process.env.GL_SMOKE_WAIT || 7000)));
}
function load() { offline = false; win.loadURL(APP_URL + '/?app=desktop'); }
function sameOrigin(url) { try { return new URL(url).origin === APP_ORIGIN; } catch { return false; } }
function openOutside(url) { if (/^https?:\/\//.test(url)) shell.openExternal(url); }

function createTray() {
  if (tray) return;
  const img = nativeImage.createFromPath(icon(isMac ? 'tray.png' : 'tray@2x.png'));
  try { tray = new Tray(img); } catch { tray = null; return; }
  tray.setToolTip('Global Link');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Global Link', click: show },
    { label: 'Check for updates', click: () => checkForUpdates(true) },
    { type: 'separator' },
    { label: 'Quit Global Link', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', show);
}

function createMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [{ role: 'about' }, { label: 'Check for Updates…', click: () => checkForUpdates(true) }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] },
    { label: 'Help', submenu: [{ label: 'globallink.com', click: () => shell.openExternal('https://global-link-club.vercel.app') }] },
  ]));
}

// ---- auto-update (GitHub Releases) ----
// Windows installs updates silently on quit. macOS apps must be signed with an
// Apple Developer ID to replace themselves, so until the app is signed the Mac
// build tells the user about a new version and opens the download page.
let manualCheck = false;
function send(ch, payload) { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); }
function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = !isMac;
  autoUpdater.on('update-available', info => {
    send('update:available', { version: info.version });
    if (isMac) dialog.showMessageBox({ type: 'info', buttons: ['Download', 'Later'], defaultId: 0, message: 'Global Link ' + info.version + ' is available', detail: 'Download the new version and drag it into Applications.' })
      .then(r => { if (r.response === 0) shell.openExternal(RELEASES); });
  });
  autoUpdater.on('update-not-available', () => { send('update:none'); if (manualCheck) dialog.showMessageBox({ type: 'info', message: 'You’re up to date', detail: 'Global Link ' + app.getVersion() }); manualCheck = false; });
  autoUpdater.on('download-progress', p => send('update:progress', { percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', info => send('update:ready', { version: info.version }));
  autoUpdater.on('error', err => { send('update:error', String(err && err.message || err)); manualCheck = false; });
  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), 4 * 3600 * 1000);
}
function checkForUpdates(manual) {
  if (!app.isPackaged) return Promise.resolve({ ok: false, reason: 'dev' });
  manualCheck = !!manual;
  return autoUpdater.checkForUpdates().then(r => ({ ok: true, version: r && r.updateInfo ? r.updateInfo.version : null })).catch(e => ({ ok: false, reason: String(e && e.message || e) }));
}

app.whenReady().then(() => {
  // Only the portal may ask for notifications and (for lessons) camera/microphone.
  const ALLOWED = new Set(['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => cb(ALLOWED.has(perm) && sameOrigin(details.requestingUrl || wc.getURL())));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ALLOWED.has(perm) && (origin === APP_ORIGIN || sameOrigin(origin)));

  createMenu();
  createWindow();
  setupUpdates();

  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
  ipcMain.handle('updates:check', () => checkForUpdates(true));
  ipcMain.on('updates:install', () => { quitting = true; autoUpdater.quitAndInstall(); });
  ipcMain.on('app:retry', () => { if (win) load(); });
  ipcMain.on('app:open-external', (_e, url) => { if (typeof url === 'string') openOutside(url); });
  ipcMain.on('app:configure', (e, cfg = {}) => {
    if (!sameOrigin(e.senderFrame.url)) return;
    keepInTray = !!cfg.tray;
    if (keepInTray) createTray(); else if (tray) { tray.destroy(); tray = null; }
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!cfg.openAtLogin, args: ['--hidden'] });
  });
  ipcMain.on('app:theme', (e, theme) => {
    if (!win || isMac || !sameOrigin(e.senderFrame.url)) return;
    const dark = theme === 'dark';
    try { win.setTitleBarOverlay({ color: dark ? '#0f1d3a' : '#f6faff', symbolColor: dark ? '#a9b9d6' : '#4a5b78', height: 46 }); } catch {}
  });
  ipcMain.on('app:badge', (_e, n) => { const c = Math.max(0, Number(n) || 0); if (isMac) app.dock.setBadge(c ? String(c) : ''); else app.setBadgeCount(c); });

  app.on('activate', show);
});
app.on('second-instance', show);
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
nativeTheme.themeSource = 'system';
