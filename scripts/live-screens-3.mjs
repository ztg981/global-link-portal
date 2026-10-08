// Features added after the first release: buying lessons (WeChat first, Stripe
// in the app), events, AI Practice, the material viewer, voice notes, video
// replies, attachments and the admin Payments page. Built in the design's style.
const r = String.raw;
const ICON = (n, s = 18, c) => r`<x-import component-from-global-scope="GLIcon" n="${n}" s="${s}"${c ? ` c="${c}"` : ''} hint-size="${s}px,${s}px"></x-import>`;
const BTN = (label, fn, variant = 'primary', size = 'sm') => r`<x-import component-from-global-scope="GlobalLinkUI.Button" variant="${variant}" size="${size}" onClick="{{ ${fn} }}" hint-size="150px,38px">${label}</x-import>`;
const SCRIM = (open, close, w, label, inner) => r`<sc-if value="{{ ${open} }}">
<div onClick="{{ ${close} }}" style="position:absolute;inset:0;z-index:62;background:rgba(12,23,48,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:grid;place-items:center;padding:20px;animation:glScrim .2s">
  <div onClick="{{ stop }}" role="dialog" aria-label="${label}" style="width:min(${w},100%);max-height:calc(100% - 24px);overflow:auto;border-radius:26px;background:var(--gl-card);box-shadow:var(--gl-shadow-pop);animation:glModal .3s var(--gl-ease-out)">
${inner}
  </div>
</div>
</sc-if>`;
const HEAD = (zh, title, sub, close) => r`<div style="padding:22px 22px 0;display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div><div style="font-family:var(--gl-font-zh);font-size:12.5px;font-weight:700;color:var(--gl-blue)">${zh}</div><b style="font-size:20px;letter-spacing:-.02em">${title}</b><div style="font-size:13px;color:var(--gl-muted);margin-top:2px">${sub}</div></div>
      <button onClick="{{ ${close} }}" title="Close" style="width:34px;height:34px;flex:none;border:0;border-radius:10px;background:var(--gl-soft);color:var(--gl-muted);cursor:pointer;display:grid;place-items:center">${ICON('x', 16)}</button>
    </div>`;
const CHIPLIST = (list, as) => r`<div style="display:flex;gap:6px;flex-wrap:wrap"><sc-for list="{{ ${list} }}" as="${as}" hint-placeholder-count="0"><x-import component-from-global-scope="GlobalLinkUI.Chip" variant="{{ ${as}.variant }}" onClick="{{ ${as}.pick }}" hint-size="90px,32px">{{ ${as}.l }}</x-import></sc-for></div>`;
const SECTION = r`padding:18px;border-radius:var(--gl-r-card);background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card);display:grid;gap:12px`;
const ROWBTN = r`height:30px;padding:0 12px;border-radius:9px;border:1px solid var(--gl-line);background:var(--gl-card);color:var(--gl-ink);font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap`;

const BUY = SCRIM('buyOpen', 'closeBuy', '560px', 'Buy lessons', r`    ${HEAD('购买课时', 'Buy lessons', 'You have {{ buy.credits }} lesson credit(s). One credit is one 40-minute lesson.', 'closeBuy')}
    <div style="padding:16px 22px;display:grid;gap:8px">
      <sc-for list="{{ buy.packs }}" as="pk" hint-placeholder-count="0">
        <button onClick="{{ pk.pick }}" style="display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;border:1.5px solid {{ pk.bd }};background:{{ pk.bg }};color:var(--gl-ink);cursor:pointer;text-align:left;transition:border-color .2s,background .2s">
          <span style="width:18px;height:18px;flex:none;border-radius:50%;border:2px solid {{ pk.bd }};display:grid;place-items:center"><span style="width:8px;height:8px;border-radius:50%;background:{{ pk.dot }}"></span></span>
          <span style="flex:1;min-width:0;line-height:1.3"><b style="display:block;font-size:14px">{{ pk.name }}</b><span style="font-size:12px;color:var(--gl-muted)">{{ pk.sub }}</span></span>
          <b style="font-family:var(--gl-font-mono);font-size:15px">¥{{ pk.price }}</b>
        </button>
      </sc-for>
    </div>
    <div style="padding:0 22px 22px;display:grid;gap:12px">
      <div style="padding:14px;border-radius:16px;background:rgba(7,193,96,.08);border:1px solid rgba(7,193,96,.35);display:grid;gap:8px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="width:28px;height:28px;border-radius:8px;background:#07c160;color:#fff;display:grid;place-items:center">${ICON('message-circle', 15)}</span><b style="font-size:15px">Pay on WeChat</b><span style="font-size:10.5px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:999px;background:rgba(7,193,96,.16);color:#078a46">HOW MOST FAMILIES PAY</span></div>
        <div style="font-size:13px;line-height:1.55;color:var(--gl-muted)">{{ buy.wechatText }}</div>
        <sc-if value="{{ buy.sent }}"><div style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:700;color:var(--gl-success)">${ICON('circle-check', 16)}Request sent. We’ll add your credits as soon as the payment arrives.</div></sc-if>
        <sc-if value="{{ buy.notSent }}"><div>${BTN('Send payment request', 'buyWechat')}</div></sc-if>
      </div>
      <sc-if value="{{ buy.stripe }}"><button onClick="{{ buyStripe }}" style="display:flex;gap:10px;align-items:center;justify-content:center;min-height:46px;border-radius:12px;border:1px solid var(--gl-line);background:var(--gl-card);color:var(--gl-ink);font-weight:700;cursor:pointer">${ICON('credit-card', 17)}Pay now by card, Alipay or WeChat Pay</button></sc-if>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--gl-faint)"><span>Paying inside the app with</span><span style="padding:3px 9px;border-radius:999px;border:1px dashed var(--gl-line)">WeChat Pay</span><span style="padding:3px 9px;border-radius:999px;border:1px dashed var(--gl-line)">Alipay</span><span>is coming soon.</span></div>
      <sc-if value="{{ buy.hasHistory }}"><div style="display:grid;gap:6px;padding-top:6px;border-top:1px solid var(--gl-line)"><b style="font-size:13px">Your payments</b><sc-for list="{{ buy.history }}" as="ph" hint-placeholder-count="0"><div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px"><span>{{ ph.name }} · {{ ph.when }}</span><span style="font-weight:700;color:{{ ph.fg }}">¥{{ ph.amount }} · {{ ph.status }}</span></div></sc-for></div></sc-if>
    </div>`);

const EVENT_FORM = SCRIM('evFormOpen', 'closeEventForm', '520px', 'Host an event', r`    ${HEAD('发布活动', 'Host an event', 'Shows in Community → Events for every student and mentor.', 'closeEventForm')}
    <div style="padding:16px 22px 22px;display:grid;gap:12px">
      <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Title" value="{{ evf.title }}" onChange="{{ evf.setTitle }}" placeholder="Halloween in America: live Q&amp;A" hint-size="100%,72px"></x-import>
      ${CHIPLIST('evf.kinds', 'ek')}
      <label style="display:grid;gap:6px;font-weight:700;font-size:14px">Starts (your time)<input type="datetime-local" value="{{ evf.when }}" onChange="{{ evf.setWhen }}" style="min-height:46px;padding:8px 12px;border:1px solid var(--gl-line);border-radius:10px;background:var(--gl-card);color:var(--gl-ink);font:500 15px var(--gl-font-ui)"></label>
      ${CHIPLIST('evf.durs', 'ed')}
      <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Meeting link (optional)" value="{{ evf.link }}" onChange="{{ evf.setLink }}" placeholder="https://…" hint-size="100%,72px"></x-import>
      <x-import component-from-global-scope="GlobalLinkUI.TextField" label="About" multiline="{{ true }}" value="{{ evf.body }}" onChange="{{ evf.setBody }}" placeholder="What will you talk about?" hint-size="100%,120px"></x-import>
      <div style="display:flex;justify-content:flex-end">${BTN('Post event', 'evf.post', 'primary', 'md')}</div>
    </div>`);

const VIEWER = r`<sc-if value="{{ mv.has }}"><div style="display:grid;gap:12px;padding:14px;border-radius:16px;background:var(--gl-soft);border:1px solid var(--gl-line)">
          <sc-for list="{{ mv.blocks }}" as="bl" hint-placeholder-count="0">
            <sc-if value="{{ bl.isH }}"><b style="font-size:16px;letter-spacing:-.01em">{{ bl.text }}</b></sc-if>
            <sc-if value="{{ bl.isT }}"><p style="margin:0;line-height:1.55;font-size:14px">{{ bl.text }}</p></sc-if>
            <sc-if value="{{ bl.isQ }}"><div style="display:grid;gap:6px"><b style="font-size:14px">{{ bl.text }}</b><sc-for list="{{ bl.opts }}" as="op" hint-placeholder-count="0"><button onClick="{{ op.pick }}" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid {{ op.bd }};background:{{ op.bg }};color:var(--gl-ink);font-weight:600;font-size:13.5px;cursor:pointer">{{ op.letter }}. {{ op.t }}</button></sc-for><sc-if value="{{ bl.answered }}"><span style="font-size:12.5px;font-weight:700;color:{{ bl.resFg }}">{{ bl.res }}</span></sc-if></div></sc-if>
            <sc-if value="{{ bl.isV }}"><button onClick="{{ bl.say }}" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid var(--gl-line);background:var(--gl-card);color:var(--gl-ink);cursor:pointer;text-align:left">${ICON('volume-2', 16, 'var(--gl-blue)')}<span style="line-height:1.35"><b>{{ bl.text }}</b> <span style="font-family:var(--gl-font-zh);color:var(--gl-muted)">{{ bl.zh }}</span><span style="display:block;font-size:12.5px;color:var(--gl-muted)">{{ bl.ex }}</span></span></button></sc-if>
            <sc-if value="{{ bl.isP }}"><div style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--gl-sticky);color:var(--gl-sticky-ink)">${ICON('mic', 16)}<span style="flex:1;font-weight:600">{{ bl.text }}</span><span style="font-family:var(--gl-font-mono);font-size:12px">{{ bl.secL }}</span></div></sc-if>
            <sc-if value="{{ bl.isM }}"><div style="display:grid;gap:6px"><span style="font-size:13px;color:var(--gl-muted)">{{ bl.text }}</span><sc-if value="{{ bl.isImage }}"><img src="{{ bl.url }}" alt="" style="max-width:100%;border-radius:12px"></sc-if><sc-if value="{{ bl.isAudio }}"><audio src="{{ bl.url }}" controls preload="none" style="width:100%"></audio></sc-if><sc-if value="{{ bl.isVideo }}"><video src="{{ bl.url }}" controls preload="metadata" playsinline style="width:100%;border-radius:12px"></video></sc-if><sc-if value="{{ bl.isDoc }}"><a href="{{ bl.url }}" target="_blank" rel="noopener" style="font-weight:700">Open {{ bl.name }}</a></sc-if></div></sc-if>
          </sc-for>
          <div style="font-size:12px;font-weight:700;color:var(--gl-faint)">{{ mv.progressLabel }}</div>
        </div></sc-if>
`;

const PRACTICE = r`<sc-if value="{{ LIVE }}"><x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,520px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:16px">Your practice path</b><span style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#f08a24">${ICON('flame', 14, '#f08a24')}{{ pr.streakLabel }}</span></div>
    <p style="margin:0 0 16px;color:var(--gl-muted);font-size:13px">A few minutes a day with Lumi. Each step uses your saved words and your goal. Tap one to start.</p>
    <div style="display:grid;gap:10px">
      <sc-for list="{{ pr.nodes }}" as="nd" hint-placeholder-count="0">
        <button onClick="{{ nd.go }}" style="display:flex;gap:14px;align-items:center;padding:12px 14px;border-radius:16px;border:1.5px solid {{ nd.bd }};background:{{ nd.bg }};color:var(--gl-ink);cursor:pointer;text-align:left;transition:transform .2s var(--gl-ease-spring)" style-hover="transform:translateY(-2px)">
          <span style="width:46px;height:46px;flex:none;border-radius:50%;background:{{ nd.iconBg }};color:{{ nd.iconFg }};display:grid;place-items:center"><x-import component-from-global-scope="GLIcon" n="{{ nd.icon }}" s="22" hint-size="22px,22px"></x-import></span>
          <span style="flex:1;min-width:0;line-height:1.35"><b style="display:block;font-size:14.5px">{{ nd.label }}</b><span style="font-size:12.5px;color:var(--gl-muted)">{{ nd.sub }}</span></span>
          <span style="font-size:11px;font-weight:800;letter-spacing:.06em;color:{{ nd.stateFg }}">{{ nd.state }}</span>
        </button>
      </sc-for>
    </div>
  </x-import></sc-if>
`;

const PAYMENTS = r`<sc-if value="{{ LIVE }}"><div data-screen-label="Admin payments" style="display:grid;gap:16px;animation:glPageIn .45s var(--gl-ease-out)">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px">
    <sc-for list="{{ ap.kpis }}" as="k" hint-placeholder-count="0"><div style="padding:16px;border-radius:18px;background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card)"><div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;color:var(--gl-faint)">{{ k.l }}</div><b style="display:block;font-size:24px;letter-spacing:-.02em;margin-top:4px">{{ k.v }}</b><span style="font-size:12px;color:var(--gl-muted)">{{ k.s }}</span></div></sc-for>
  </div>
  <div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;border:1px dashed var(--gl-line);font-size:12.5px;color:var(--gl-muted)">${ICON('info', 15)}<span>Most families pay on WeChat. When a payment arrives, confirm the request below (or record it), and their lesson credits appear right away. {{ ap.stripeLine }}</span></div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
    <section style="flex:999 1 460px;min-width:0;${SECTION}">
      <b style="font-size:15px">Waiting for payment</b>
      <sc-for list="{{ ap.pending }}" as="pp" hint-placeholder-count="0"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:var(--gl-soft)"><span style="flex:1;min-width:160px;line-height:1.35"><b style="font-size:13.5px">{{ pp.who }}</b><span style="display:block;font-size:12px;color:var(--gl-muted)">{{ pp.what }} · ¥{{ pp.amount }} · #{{ pp.id }} · {{ pp.when }}</span></span><button onClick="{{ pp.confirm }}" style="${ROWBTN};background:var(--gl-success);border-color:var(--gl-success);color:#fff">Payment received</button><button onClick="{{ pp.cancel }}" style="${ROWBTN}">Cancel</button></div></sc-for>
      <sc-if value="{{ ap.pendingEmpty }}"><span style="font-size:13px;color:var(--gl-muted)">No payment requests waiting.</span></sc-if>
      <b style="font-size:15px;margin-top:6px">All payments</b>
      <sc-for list="{{ ap.all }}" as="py" hint-placeholder-count="0"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--gl-line)"><span style="flex:1;min-width:160px;line-height:1.35"><b style="font-size:13px;text-decoration:{{ py.deco }}">{{ py.who }} · {{ py.what }}</b><span style="display:block;font-size:12px;color:var(--gl-muted)">{{ py.method }} · {{ py.when }} · {{ py.credits }} credits</span></span><b style="font-family:var(--gl-font-mono);font-size:13px">¥{{ py.amount }}</b><span style="font-size:11.5px;font-weight:800;color:{{ py.fg }}">{{ py.status }}</span><sc-if value="{{ py.canRefund }}"><button onClick="{{ py.refund }}" style="${ROWBTN}">Refund</button></sc-if></div></sc-for>
      <sc-if value="{{ ap.allEmpty }}"><span style="font-size:13px;color:var(--gl-muted)">No payments yet.</span></sc-if>
    </section>
    <div style="flex:1 1 300px;min-width:0;display:grid;gap:16px">
      <section style="${SECTION}">
        <b style="font-size:15px">Record a WeChat payment</b>
        <span style="font-size:12.5px;color:var(--gl-muted)">For payments that came in without a request in the app.</span>
        <x-import component-from-global-scope="GlobalLinkUI.Select" options="{{ ap.studentOpts }}" value="{{ ap.recUser }}" onChange="{{ ap.setRecUser }}" placeholder="Choose a student…" hint-size="100%,40px"></x-import>
        <x-import component-from-global-scope="GlobalLinkUI.Select" options="{{ ap.packOpts }}" value="{{ ap.recPack }}" onChange="{{ ap.setRecPack }}" placeholder="Choose a plan…" hint-size="100%,40px"></x-import>
        <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Amount received (¥)" value="{{ ap.recAmount }}" onChange="{{ ap.setRecAmount }}" hint-size="100%,72px"></x-import>
        <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Note (optional)" value="{{ ap.recNote }}" onChange="{{ ap.setRecNote }}" placeholder="WeChat transfer from Mrs. Chen" hint-size="100%,72px"></x-import>
        <div>${BTN('Record payment', 'ap.record')}</div>
      </section>
      <section style="${SECTION}">
        <b style="font-size:15px">Plans and prices</b>
        <sc-for list="{{ aPkgs }}" as="pk" hint-placeholder-count="0"><div style="display:flex;gap:10px;align-items:center;opacity:{{ pk.op }}"><span style="flex:1;min-width:0;font-size:13px;font-weight:700">{{ pk.name }}</span><span style="font-size:12px;color:var(--gl-faint)">¥</span><input value="{{ pk.price }}" onChange="{{ pk.setPrice }}" inputmode="numeric" style="width:76px;min-height:34px;padding:4px 8px;border:1px solid var(--gl-line);border-radius:9px;background:var(--gl-card);color:var(--gl-ink);font:600 13px var(--gl-font-mono)"><button onClick="{{ pk.toggle }}" role="switch" style="width:40px;height:24px;flex:none;border:0;border-radius:999px;background:{{ pk.bg }};position:relative;cursor:pointer"><span style="position:absolute;top:2px;left:{{ pk.x }};width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s"></span></button></div></sc-for>
      </section>
      <section style="${SECTION}">
        <b style="font-size:15px">Mentor payouts</b>
        <span style="font-size:12.5px;color:var(--gl-muted)">Finished lessons per month at {{ ap.rateLabel }}.</span>
        <sc-for list="{{ ap.payouts }}" as="po" hint-placeholder-count="0"><div style="display:flex;gap:10px;align-items:center"><span style="flex:1;min-width:0;line-height:1.3"><b style="font-size:13px">{{ po.name }}</b><span style="display:block;font-size:12px;color:var(--gl-muted)">{{ po.month }} · {{ po.lessons }} lessons</span></span><b style="font-family:var(--gl-font-mono);font-size:13px">&#36;{{ po.amount }}</b><sc-if value="{{ po.paid }}"><span style="font-size:11.5px;font-weight:800;color:var(--gl-success)">PAID</span></sc-if><sc-if value="{{ po.unpaid }}"><button onClick="{{ po.pay }}" style="${ROWBTN}">Mark paid</button></sc-if></div></sc-for>
        <sc-if value="{{ ap.payoutsEmpty }}"><span style="font-size:13px;color:var(--gl-muted)">No finished lessons yet.</span></sc-if>
      </section>
    </div>
  </div>
</div></sc-if>`;

const ADMIN_EVENTS = r`  <sc-if value="{{ LIVE }}"><section style="flex:1 1 320px;min-width:0;${SECTION}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div style="font-family:var(--gl-font-zh);font-size:12px;font-weight:700;color:#c98a12">社区活动</div><b style="font-size:16px">Community events</b></div>${BTN('Post an event', 'openEventForm', 'soft')}</div>
    <sc-for list="{{ aEvents }}" as="ae" hint-placeholder-count="0"><div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--gl-line)"><span style="flex:1;min-width:0;line-height:1.35"><b style="font-size:13px">{{ ae.title }}</b><span style="display:block;font-size:12px;color:var(--gl-muted)">{{ ae.when }} · {{ ae.host }} · {{ ae.going }} going</span></span><button onClick="{{ ae.remove }}" style="${ROWBTN}">Remove</button></div></sc-for>
    <sc-if value="{{ aEventsEmpty }}"><span style="font-size:13px;color:var(--gl-muted)">No upcoming events.</span></sc-if>
  </section></sc-if>
`;

const FILE_BLOCK = r`<sc-if value="{{ m.hasFile }}"><span style="display:block;margin-top:8px"><sc-if value="{{ m.isAudio }}"><audio src="{{ m.fileUrl }}" controls preload="none" style="width:230px;max-width:100%;height:38px"></audio></sc-if><sc-if value="{{ m.isImage }}"><a href="{{ m.fileUrl }}" target="_blank" rel="noopener"><img src="{{ m.fileUrl }}" alt="" style="display:block;max-width:220px;max-height:220px;border-radius:12px"></a></sc-if><sc-if value="{{ m.isVideo }}"><video src="{{ m.fileUrl }}" controls preload="metadata" playsinline style="display:block;max-width:240px;border-radius:12px"></video></sc-if><sc-if value="{{ m.isDoc }}"><a href="{{ m.fileUrl }}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;font-weight:700">📎 {{ m.fileName }}</a></sc-if></span></sc-if>`;

const CREDITS_ROW = r`
            <sc-if value="{{ isStudentRole }}"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:14px;background:var(--gl-soft);border:1px solid var(--gl-line)"><span style="color:var(--gl-blue)">${ICON('ticket', 20)}</span><span style="flex:1;min-width:160px;line-height:1.35"><b style="font-size:14px">{{ buy.credits }} lesson credit(s)</b><span style="display:block;font-size:12px;color:var(--gl-muted)">{{ buy.packsLabel }}</span></span>${BTN('Buy lessons', 'openBuy', 'soft')}</div></sc-if>`;

export const MORE_SCREENS_3 = [
  // Modals live next to the material window.
  [r`<sc-if value="{{ matOpen }}">`, BUY + '\n' + EVENT_FORM + '\n' + r`<sc-if value="{{ matOpen }}">`],
  // Material viewer (real materials have content blocks).
  [r`    <div onClick="{{ stop }}" style="width:min(460px,100%);border-radius:26px;background:var(--gl-card);box-shadow:var(--gl-shadow-pop);overflow:hidden;animation:glModal .3s var(--gl-ease-out)">`,
   r`    <div onClick="{{ stop }}" style="width:min({{ T.matW }},100%);max-height:calc(100% - 24px);overflow:auto;border-radius:26px;background:var(--gl-card);box-shadow:var(--gl-shadow-pop);animation:glModal .3s var(--gl-ease-out)">`],
  [/(\{\{ matSel\.cls \}\} · shared by[^\n]*\n)/, m => m + '        ' + VIEWER],
  // Video replies play in the video window.
  [r`<div style="position:relative;aspect-ratio:16/9;background:url({{ vf.photo }}) center 22%/cover">`,
   r`<div style="position:relative;aspect-ratio:16/9;background:url({{ vf.photo }}) center 22%/cover"><sc-if value="{{ vf.video }}"><video src="{{ vf.video }}" controls autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:1"></video></sc-if>`],
  // Mentor's video reply recorder: live camera preview.
  [r`<div style="position:relative;aspect-ratio:16/9;max-height:300px;border-radius:18px;overflow:hidden;background:url(assets/emma.png) center 25%/cover #0c1730">`,
   r`<div style="position:relative;aspect-ratio:16/9;max-height:300px;border-radius:18px;overflow:hidden;background:{{ T.recBg }}"><sc-if value="{{ LIVE }}"><video id="gl-rec-video" muted playsinline autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video></sc-if>`],
  // Voice notes: each task records for itself.
  [r`onClick="{{ startTaskRec }}"`, r`onClick="{{ tk.startRec }}"`],
  // Messages: attach a file; files show in the bubbles.
  [r`<button title="Attach"`, r`<button onClick="{{ attachFile }}" title="Attach"`],
  [r`text-wrap:pretty">{{ m.t }}<sc-if value="{{ m.hasMats }}">`, r`text-wrap:pretty">{{ m.t }}` + FILE_BLOCK + r`<sc-if value="{{ m.hasMats }}">`],
  [r`background:var(--gl-grad-cta);color:#fff;text-align:left;text-wrap:pretty">{{ m.t }}</div>`, r`background:var(--gl-grad-cta);color:#fff;text-align:left;text-wrap:pretty">{{ m.t }}` + FILE_BLOCK + '</div>'],
  // AI Practice: a real practice path for live accounts.
  [/(  <div style="grid-column:1\/-1;display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:18px 20px;border-radius:var\(--gl-r-card\);background:var\(--gl-sticky\)[\s\S]*?\n  <\/x-import>\n)(  <x-import component-from-global-scope="GlobalLinkUI\.Card" padding="md"[^\n]*>\n[^\n]*\n[^\n]*\n[^\n]*LumiAvatar" size="\{\{ 44 \}\}")/,
   (m, demo, lumi) => '<sc-if value="{{ DEMO }}">' + demo + '</sc-if>' + PRACTICE + lumi],
  // Community events: host button, join links.
  [r`  <sc-if value="{{ comIsEvents }}">`, r`  <sc-if value="{{ comIsEvents }}">
    <sc-if value="{{ canHostEvent }}"><div style="display:flex;justify-content:flex-end;margin-bottom:12px">${BTN('Host an event', 'openEventForm')}</div></sc-if>`],
  [r`>{{ ev.rsvpLabel }}</button>`, r`>{{ ev.rsvpLabel }}</button><sc-if value="{{ ev.hasLink }}"><a href="{{ ev.link }}" target="_blank" rel="noopener" style="font-size:12.5px;font-weight:700;margin-left:10px">Join link</a></sc-if>`],
  // Admin: events on the Announcements page, a real Payments page.
  [r`</div>
</sc-if>

<sc-if value="{{ P.a_system }}">`, ADMIN_EVENTS + r`</div>
</sc-if>

<sc-if value="{{ P.a_system }}">`],
  [/(<div data-screen-label="Admin payments"[^\n]*To be built<\/div>)/, m => '<sc-if value="{{ DEMO }}">' + m + '</sc-if>' + PAYMENTS],
  // Settings: lesson credits.
  [r`hint="Separate with commas. Mentors use these to plan lessons." hint-size="100%,90px"></x-import>`, r`hint="Separate with commas. Mentors use these to plan lessons." hint-size="100%,90px"></x-import>` + CREDITS_ROW],
];
