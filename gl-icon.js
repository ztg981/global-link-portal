// GLIcon — Lucide line icon (inline SVG, inherits currentColor). Fetched once per name and cached.
// Usage in a DC: <x-import component-from-global-scope="GLIcon" n="bell" s="18"></x-import>
(function () {
  // Self-hosted first (vendor/lucide, reachable in mainland China), unpkg as a fallback.
  var LOCAL = 'vendor/lucide/', CDN = 'https://unpkg.com/lucide-static@0.460.0/icons/';
  var cache = {}, pending = {};
  function load(n) {
    if (cache[n] || pending[n]) return pending[n] || Promise.resolve(cache[n]);
    pending[n] = fetch(LOCAL + n + '.svg').then(function (r) { if (!r.ok) throw 0; return r.text(); }).catch(function () { return fetch(CDN + n + '.svg').then(function (r) { return r.ok ? r.text() : ''; }); }).catch(function () { return ''; }).then(function (t) {
      t = t.replace(/<!--[\s\S]*?-->/g, '').replace(/\swidth="24"/, ' width="100%"').replace(/\sheight="24"/, ' height="100%"').replace(/stroke-width="2"/, 'stroke-width="1.9"');
      cache[n] = t; delete pending[n]; return t;
    });
    return pending[n];
  }
  window.GLIcon = function GLIcon(p) {
    var n = p.n || 'circle';
    var s = Number(p.s || 18);
    var st = React.useState(cache[n] || '');
    var html = p.fill && st[0] ? st[0].replace('fill="none"', 'fill="' + p.fill + '"') : st[0];
    React.useEffect(function () { var live = true; if (!cache[n]) load(n).then(function (t) { if (live) st[1](t); }); else st[1](cache[n]); return function () { live = false; }; }, [n]);
    return React.createElement('span', {
      'aria-hidden': p.label ? undefined : true, 'aria-label': p.label, role: p.label ? 'img' : undefined,
      style: Object.assign({ display: 'inline-flex', flex: 'none', width: s, height: s, color: p.c || 'currentColor', lineHeight: 0 }, p.style || {}),
      dangerouslySetInnerHTML: { __html: html }
    });
  };
})();
