// The only bridge between the portal page and the desktop shell. Exposes a
// small, fixed API as window.glDesktop (no Node, no raw ipcRenderer).
const { contextBridge, ipcRenderer } = require('electron');

const listeners = {};
for (const ch of ['update:available', 'update:progress', 'update:ready', 'update:none', 'update:error']) {
  ipcRenderer.on(ch, (_e, payload) => (listeners[ch] || []).forEach(fn => { try { fn(payload); } catch {} }));
}

contextBridge.exposeInMainWorld('glDesktop', {
  platform: process.platform,
  info: () => ipcRenderer.invoke('app:info'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.send('updates:install'),
  onUpdate: (ch, fn) => { (listeners['update:' + ch] = listeners['update:' + ch] || []).push(fn); },
  configure: cfg => ipcRenderer.send('app:configure', { openAtLogin: !!(cfg && cfg.openAtLogin), tray: !!(cfg && cfg.tray) }),
  setTheme: theme => ipcRenderer.send('app:theme', String(theme)),
  setBadge: n => ipcRenderer.send('app:badge', Number(n) || 0),
  openExternal: url => ipcRenderer.send('app:open-external', String(url)),
  retry: () => ipcRenderer.send('app:retry'),
});
