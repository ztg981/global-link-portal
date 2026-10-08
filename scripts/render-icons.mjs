// Renders icons/icon.svg to every PNG the web app, iOS and Electron need.
// 1) headless Edge/Chrome screenshots 1024px masters (rounded, full-bleed, maskable, desktop)
// 2) Windows' System.Drawing resizes them (high-quality bicubic).
//   node scripts/render-icons.mjs        (Windows; the PNGs are committed)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const slash = p => p.split(String.fromCharCode(92)).join('/');
const root = slash(fileURLToPath(new URL('../', import.meta.url)));
const browser = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!browser) throw new Error('Needs Edge or Chrome');
const svg = readFileSync(root + 'icons/icon.svg', 'utf8');
const tmpDir = slash(process.env.TEMP || '/tmp') + '/gl-icons';
mkdirSync(tmpDir, { recursive: true });
mkdirSync(root + 'desktop/build', { recursive: true });

function master(name, markup) {
  const html = tmpDir + '/' + name + '.html';
  writeFileSync(html, '<!doctype html><html><body style="margin:0;width:1024px;height:1024px;overflow:hidden;background:transparent">' + markup + '</body></html>');
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + tmpDir + '/profile-' + name, '--force-device-scale-factor=1', '--hide-scrollbars',
    '--default-background-color=00000000', '--window-size=1024,1024', '--screenshot=' + tmpDir + '/' + name + '.png', 'file:///' + html], { stdio: 'ignore', timeout: 60000 });
  return tmpDir + '/' + name + '.png';
}
const sized = (s, n) => s.replace('<svg ', '<svg width="' + n + '" height="' + n + '" ');
const flat = svg.replace(/rx="112"/g, 'rx="0"');
const round = master('round', sized(svg, 1024));
const square = master('square', sized(flat, 1024));
// Maskable: full-bleed background, artwork inside the 80% safe zone.
const mask = master('mask', '<div style="position:absolute;inset:0;background:linear-gradient(135deg,#46a0ff,#1f6fd8)"></div><div style="position:absolute;left:102px;top:102px">' + sized(flat, 820) + '</div>');
// Desktop icon: a little transparent margin like native app icons.
const desk = master('desk', '<div style="position:absolute;left:82px;top:82px">' + sized(svg, 860) + '</div>');

const OUT = [[round, 'icons/icon-512.png', 512], [round, 'icons/icon-192.png', 192], [round, 'icons/favicon-32.png', 32], [square, 'icons/apple-touch-icon.png', 180],
  [mask, 'icons/maskable-512.png', 512], [desk, 'desktop/build/icon.png', 1024], [round, 'desktop/build/tray.png', 16], [round, 'desktop/build/tray@2x.png', 32]];
const ps = OUT.map(([src, out, size]) => `$s=[System.Drawing.Image]::FromFile('${src}');$b=New-Object System.Drawing.Bitmap ${size},${size};$g=[System.Drawing.Graphics]::FromImage($b);$g.InterpolationMode='HighQualityBicubic';$g.SmoothingMode='HighQuality';$g.PixelOffsetMode='HighQuality';$g.CompositingQuality='HighQuality';$g.DrawImage($s,0,0,${size},${size});$b.Save('${root + out}',[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$b.Dispose();$s.Dispose();`).join('');
execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Drawing;' + ps], { stdio: 'inherit' });
rmSync(tmpDir, { recursive: true, force: true });
OUT.forEach(o => console.log(o[1]));
