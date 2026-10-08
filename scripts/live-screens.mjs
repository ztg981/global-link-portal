// LIVE versions of the screens whose design markup has the sample data typed in.
// Same layout, spacing and components as the design; bound to real data, with
// empty states for brand-new accounts. Demo markup is kept and shown for DEMO.
import { MORE_SCREENS } from './live-screens-2.mjs';
const r = String.raw;

const GLOW = r`<div style="position:absolute;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(70,160,255,.32),transparent 70%);top:-160px;right:-80px;pointer-events:none"></div>
      <div style="position:absolute;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(70,160,255,.18),transparent 70%);bottom:-120px;left:30%;pointer-events:none"></div>`;
const HERO = r`flex:2 1 520px;position:relative;overflow:hidden;border-radius:24px;background:var(--gl-grad-navy);color:#fff;padding:26px 28px;display:flex;flex-direction:column;gap:20px;box-shadow:var(--gl-shadow-raised);min-height:270px`;
const PILL = r`font-size:11.5px;font-weight:800;letter-spacing:.08em;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.12);color:#cfe2ff;white-space:nowrap`;
const GHOST = r`height:46px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .2s`;
const LINK = r`border:0;background:none;color:var(--gl-link);font-weight:700;font-size:13px;cursor:pointer`;
const EMPTY = (icon, text) => r`<div style="display:grid;justify-items:center;gap:8px;padding:22px 10px;text-align:center;color:var(--gl-muted);font-size:13px"><span style="width:40px;height:40px;border-radius:12px;background:var(--gl-soft);color:var(--gl-faint);display:grid;place-items:center"><x-import component-from-global-scope="GLIcon" n="${icon}" s="18" hint-size="18px,18px"></x-import></span>${text}</div>`;
const UP_ROW = r`<sc-for list="{{ upcoming }}" as="u" hint-placeholder-count="0">
          <button onClick="{{ u.open }}" style="display:flex;gap:12px;align-items:center;padding:8px;border:0;border-radius:12px;background:transparent;color:var(--gl-ink);cursor:pointer;text-align:left;transition:background .2s" style-hover="background:var(--gl-soft)">
            <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ u.person }}" src="{{ u.photo }}" size="{{ 36 }}" hint-size="36px,36px"></x-import>
            <div style="min-width:0;flex:1"><div style="font-weight:700;font-size:13.5px">{{ u.person }} · {{ u.cls }}</div><div style="font-size:12px;color:var(--gl-muted)">{{ u.rel }} · <span style="font-family:var(--gl-font-mono)">{{ u.time }}</span></div><div style="font-size:11.5px;color:var(--gl-faint)">{{ u.other }}</div></div>
          </button>
        </sc-for>`;

const HOME = r`<sc-if value="{{ LIVE }}">
<div data-screen-label="Student home" style="display:grid;gap:16px;animation:gl-rise .5s var(--gl-ease-out)">
  <div style="display:flex;flex-wrap:wrap;gap:16px">
    <div style="${HERO}">
      ${GLOW}
      <sc-if value="{{ lv.hasNext }}">
        <div style="position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="${PILL}">{{ lv.nextUpper }}</span>
          <sc-if value="{{ lv.requested }}"><span style="font-size:12.5px;font-weight:600;color:#cfe2ff">Booked on globallink.com · we’ll confirm your mentor</span></sc-if>
        </div>
        <div style="position:relative;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ lv.peerName }}" size="{{ 76 }}" hint-size="76px,76px"></x-import>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:#9cc3f2">{{ lv.nextCls }} · with {{ lv.peerName }}</div>
            <h2 style="margin:3px 0 0;font-size:25px;line-height:1.2;font-weight:800;letter-spacing:-.02em;text-wrap:balance">{{ lv.nextTopic }}</h2>
          </div>
        </div>
        <div style="position:relative;margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap">
          <div style="display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap">
            <div><div style="font-family:var(--gl-font-mono);font-size:38px;font-weight:700;line-height:1;letter-spacing:-.02em">{{ countBig }}</div><div style="font-size:12px;color:#9cc3f2;margin-top:4px">until we start</div></div>
            <div style="display:grid;gap:2px;font-size:13px;padding-bottom:2px"><span><b style="font-family:var(--gl-font-mono)">{{ lv.mine }}</b> {{ lv.mineDay }} in {{ lv.city }}</span><span style="color:#9cc3f2">{{ lv.other }}</span></div>
          </div>
          <sc-if value="{{ lv.canJoin }}"><div style="display:flex;gap:10px;flex-wrap:wrap">
            <button onClick="{{ msgEmma }}" style="${GHOST}" style-hover="background:rgba(255,255,255,.16)"><x-import component-from-global-scope="GLIcon" n="message-circle" s="16" hint-size="16px,16px"></x-import>Message {{ lv.peerFirst }}</button>
            <x-import component-from-global-scope="GlobalLinkUI.Button" variant="primary" size="md" arrow="{{ true }}" onClick="{{ openPrejoin }}" hint-size="150px,46px">Join lesson</x-import>
          </div></sc-if>
        </div>
      </sc-if>
      <sc-if value="{{ lv.noNext }}">
        <div style="position:relative;display:flex;align-items:center;gap:10px"><span style="${PILL}">WELCOME TO GLOBAL LINK</span></div>
        <div style="position:relative;max-width:520px">
          <h2 style="margin:0;font-size:27px;line-height:1.2;font-weight:800;letter-spacing:-.02em;text-wrap:balance">{{ lv.emptyTitle }}</h2>
          <p style="margin:8px 0 0;color:#c9dbf7;font-size:14.5px;line-height:1.6">{{ lv.emptySub }}</p>
        </div>
        <div style="position:relative;margin-top:auto;display:flex;gap:10px;flex-wrap:wrap">
          <sc-if value="{{ lv.noMentors }}"><x-import component-from-global-scope="GlobalLinkUI.Button" variant="primary" size="md" arrow="{{ true }}" onClick="{{ openReqHome }}" hint-size="190px,46px">Request a mentor</x-import></sc-if>
          <sc-if value="{{ lv.hasMentors }}"><x-import component-from-global-scope="GlobalLinkUI.Button" variant="primary" size="md" arrow="{{ true }}" onClick="{{ bookHome }}" hint-size="170px,46px">Book a lesson</x-import>
            <button onClick="{{ goMessages }}" style="${GHOST}" style-hover="background:rgba(255,255,255,.16)"><x-import component-from-global-scope="GLIcon" n="message-circle" s="16" hint-size="16px,16px"></x-import>Message your mentor</button></sc-if>
          <button onClick="{{ openLumi }}" style="${GHOST}" style-hover="background:rgba(255,255,255,.16)"><x-import component-from-global-scope="GLIcon" n="sparkles" s="16" hint-size="16px,16px"></x-import>Ask Lumi how it works</button>
        </div>
      </sc-if>
    </div>
    <div style="flex:1 1 300px;display:grid;gap:16px;align-content:start">
      <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,170px">
        <div style="display:grid;gap:14px">
          <div style="display:flex;gap:14px;align-items:center">
            <x-import component-from-global-scope="GlobalLinkUI.LumiAvatar" size="{{ 52 }}" online="{{ true }}" hint-size="52px,52px"></x-import>
            <div style="min-width:0"><div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;color:var(--gl-faint);white-space:nowrap">DAILY WARM-UP</div><div style="font-weight:800;font-size:16px">Practice with Lumi</div><div style="color:var(--gl-muted);font-size:13px">A few minutes of English between lessons</div></div>
          </div>
          <x-import component-from-global-scope="GlobalLinkUI.Button" variant="soft" size="sm" fullWidth="{{ true }}" onClick="{{ openLumi }}" hint-size="100%,38px">Warm up with Lumi</x-import>
          <button onClick="{{ goPractice }}" style="display:flex;align-items:center;gap:6px;justify-self:center;border:0;background:none;color:var(--gl-link);font-weight:700;font-size:12.5px;cursor:pointer;padding:0"><x-import component-from-global-scope="GLIcon" n="sparkles" s="13" hint-size="13px,13px"></x-import>Try AI Practice</button>
        </div>
      </x-import>
      <div onClick="{{ goSettingsAcct }}" title="Edit your goal" style="padding:6px 6px 0;cursor:pointer;transition:transform .3s var(--gl-ease-spring)" style-hover="transform:translateY(-3px) rotate(-1deg)">
        <x-import component-from-global-scope="GlobalLinkUI.StickyNote" title="MY GOAL" tape="{{ true }}" tilt="{{ -1.5 }}" hint-size="100%,96px">{{ lv.goal }}</x-import>
        <div style="margin-top:10px;font-size:12px;color:var(--gl-faint);display:flex;align-items:center;gap:6px"><x-import component-from-global-scope="GLIcon" n="pen-line" s="12" hint-size="12px,12px"></x-import>Your mentors see this. Tap to edit.</div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:16px">
    <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,260px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="font-size:16px">Before next time</b><button onClick="{{ goTasks }}" style="${LINK}">All tasks</button></div>
      <div style="display:grid;gap:4px">
        <sc-for list="{{ todoTasks }}" as="tk" hint-placeholder-count="0">
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 8px;border-radius:12px;transition:background .2s" style-hover="background:var(--gl-soft)">
            <button onClick="{{ tk.toggle }}" title="Mark done" style="width:22px;height:22px;flex:none;margin-top:1px;border-radius:7px;border:2px solid var(--gl-blue-soft);background:var(--gl-card);cursor:pointer;transition:all .2s" style-hover="border-color:var(--gl-blue);background:var(--gl-tint)"></button>
            <div style="min-width:0"><div style="font-weight:600;line-height:1.35;text-wrap:pretty">{{ tk.title }}</div><div style="font-size:12px;color:var(--gl-muted);margin-top:3px">{{ tk.mentor }} · due {{ tk.due }}</div></div>
          </div>
        </sc-for>
        <sc-if value="{{ lv.todoEmpty }}">${EMPTY('square-check-big', 'Nothing due right now. Tasks from your mentors show up here.')}</sc-if>
      </div>
    </x-import>
    <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,260px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="font-size:16px">Coming up</b><button onClick="{{ goSchedule }}" style="${LINK}">Schedule</button></div>
      <div style="display:grid;gap:8px">
        ${UP_ROW}
        <sc-if value="{{ lv.upEmpty }}">${EMPTY('calendar', 'No lessons booked yet.')}</sc-if>
      </div>
    </x-import>
    <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,260px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><b style="font-size:16px">From your mentors</b><button onClick="{{ goAsk }}" style="${LINK}">Ask a mentor</button></div>
      <div style="display:grid;gap:14px">
        <sc-for list="{{ lv.notes }}" as="n" hint-placeholder-count="0">
          <div style="padding:4px 6px 0"><x-import component-from-global-scope="GlobalLinkUI.StickyNote" color="{{ n.color }}" tilt="{{ n.tilt }}" hint-size="100%,100px">{{ n.t }}<span style="display:block;font-size:16px;opacity:.7;margin-top:6px">{{ n.name }}, after your lesson</span></x-import></div>
        </sc-for>
        <sc-if value="{{ lv.notesEmpty }}">${EMPTY('sticky-note', 'After each lesson, your mentor’s notes land here.')}</sc-if>
      </div>
    </x-import>
  </div>
</div>
</sc-if>
<sc-if value="{{ DEMO }}">`;

const TODAY = r`<sc-if value="{{ LIVE }}">
<div data-screen-label="Mentor today" style="display:grid;gap:16px;animation:gl-rise .5s var(--gl-ease-out)">
  <div style="display:flex;flex-wrap:wrap;gap:16px">
    <div style="${HERO}">
      ${GLOW}
      <sc-if value="{{ lv.hasNext }}">
        <div style="position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="${PILL}">{{ lv.nextUpper }}</span>
          <span style="font-size:12.5px;font-weight:600;color:#cfe2ff">Lesson {{ lv.lessonN }} with {{ lv.peerFirst }}</span>
        </div>
        <div style="position:relative;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ lv.peerName }}" size="{{ 76 }}" hint-size="76px,76px"></x-import>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:#9cc3f2">{{ lv.nextCls }} · with {{ lv.peerName }}</div>
            <h2 style="margin:3px 0 0;font-size:25px;line-height:1.2;font-weight:800;letter-spacing:-.02em;text-wrap:balance">{{ lv.nextTopic }}</h2>
          </div>
        </div>
        <sc-if value="{{ lv.hasPeerGoal }}"><div style="position:relative;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:13px;color:#dce9ff;display:flex;gap:10px;align-items:flex-start;max-width:520px"><x-import component-from-global-scope="GLIcon" n="target" s="16" c="#9cc3f2" hint-size="16px,16px"></x-import><span><b style="color:#fff">Their goal:</b> {{ lv.peerGoal }}</span></div></sc-if>
        <sc-if value="{{ lv.hasPrep }}"><div style="position:relative;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:13px;color:#dce9ff;display:flex;gap:10px;align-items:flex-start;max-width:520px"><x-import component-from-global-scope="GLIcon" n="notebook-pen" s="16" c="#9cc3f2" hint-size="16px,16px"></x-import><span><b style="color:#fff">Your prep:</b> {{ lv.prep }}</span></div></sc-if>
        <div style="position:relative;margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap">
          <div style="display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap">
            <div><div style="font-family:var(--gl-font-mono);font-size:38px;font-weight:700;line-height:1;letter-spacing:-.02em">{{ countBig }}</div><div style="font-size:12px;color:#9cc3f2;margin-top:4px">until we start</div></div>
            <div style="display:grid;gap:2px;font-size:13px;padding-bottom:2px"><span><b style="font-family:var(--gl-font-mono)">{{ lv.mine }}</b> {{ lv.mineDay }} in {{ lv.city }}</span><span style="color:#9cc3f2">{{ lv.other }}</span></div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button onClick="{{ viewPeer }}" style="${GHOST}" style-hover="background:rgba(255,255,255,.16)">{{ lv.peerFirst }}’s profile</button>
            <x-import component-from-global-scope="GlobalLinkUI.Button" variant="primary" size="md" arrow="{{ true }}" onClick="{{ openPrejoin }}" hint-size="150px,46px">Open lesson room</x-import>
          </div>
        </div>
      </sc-if>
      <sc-if value="{{ lv.noNext }}">
        <div style="position:relative"><span style="${PILL}">WELCOME TO GLOBAL LINK</span></div>
        <div style="position:relative;max-width:520px">
          <h2 style="margin:0;font-size:27px;line-height:1.2;font-weight:800;letter-spacing:-.02em;text-wrap:balance">No lessons booked yet</h2>
          <p style="margin:8px 0 0;color:#c9dbf7;font-size:14.5px;line-height:1.6">Paint your weekly hours in Availability so students can book you. When Global Link matches you with a student, the request shows up in Students.</p>
        </div>
        <div style="position:relative;margin-top:auto;display:flex;gap:10px;flex-wrap:wrap">
          <x-import component-from-global-scope="GlobalLinkUI.Button" variant="primary" size="md" arrow="{{ true }}" onClick="{{ goAvail }}" hint-size="190px,46px">Set my hours</x-import>
          <button onClick="{{ goStudents }}" style="${GHOST}" style-hover="background:rgba(255,255,255,.16)"><x-import component-from-global-scope="GLIcon" n="users" s="16" hint-size="16px,16px"></x-import>Students</button>
        </div>
      </sc-if>
    </div>
    <div style="flex:1 1 300px;display:grid;gap:16px;align-content:start">
      <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,300px">
        <b style="font-size:16px;display:block;margin-bottom:12px">Waiting on you</b>
        <sc-if value="{{ lv.hasFeedbackDue }}"><div style="display:flex;gap:12px;align-items:center;padding:10px;border-radius:14px;background:var(--gl-sticky);color:var(--gl-sticky-ink);margin-bottom:10px">
          <x-import component-from-global-scope="GLIcon" n="pen-line" s="18" hint-size="18px,18px"></x-import>
          <div style="flex:1;min-width:0;line-height:1.3"><b style="font-size:13px">Lesson notes</b><div style="font-size:12px;opacity:.8">{{ lv.feedbackDue }} lesson(s) waiting for notes</div></div>
          <button onClick="{{ openFeedback }}" style="height:30px;padding:0 12px;border:0;border-radius:9px;background:#3d3100;color:#fff6c9;font-weight:700;font-size:12px;cursor:pointer">Write</button>
        </div></sc-if>
        <sc-if value="{{ hasTReqs }}"><button onClick="{{ goStudents }}" style="width:100%;display:flex;gap:12px;align-items:center;padding:10px;border-radius:14px;border:1px solid var(--gl-blue-soft);background:var(--gl-tint);color:var(--gl-ink);cursor:pointer;text-align:left;margin-bottom:10px"><x-import component-from-global-scope="GLIcon" n="user-plus" s="18" c="var(--gl-blue)" hint-size="18px,18px"></x-import><span style="flex:1;font-size:13px"><b>{{ lv.reqsWaiting }} new student request(s)</b><span style="display:block;font-size:12px;color:var(--gl-muted)">Accept or decline in Students</span></span></button></sc-if>
        <sc-for list="{{ tqTop }}" as="q" hint-placeholder-count="0">
          <button onClick="{{ goQuestions }}" style="width:100%;display:flex;gap:12px;align-items:center;padding:8px;border:0;border-radius:12px;background:transparent;color:var(--gl-ink);cursor:pointer;text-align:left" style-hover="background:var(--gl-soft)">
            <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ q.name }}" src="{{ q.photo }}" size="{{ 32 }}" hint-size="32px,32px"></x-import>
            <span style="min-width:0;flex:1"><span style="display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ q.q }}</span><span style="font-size:11.5px;color:var(--gl-muted)">{{ q.first }} · {{ q.type }} · {{ q.left }}</span></span>
          </button>
        </sc-for>
        <sc-if value="{{ lv.nothingWaiting }}">${EMPTY('circle-check', 'Nothing waiting on you. Nice.')}</sc-if>
      </x-import>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px">
    <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,240px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="font-size:16px">Coming up</b><button onClick="{{ goSchedule }}" style="${LINK}">Schedule</button></div>
      <div style="display:grid;gap:6px">${UP_ROW}<sc-if value="{{ lv.upEmpty }}">${EMPTY('calendar', 'No lessons booked yet.')}</sc-if></div>
    </x-import>
    <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,240px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="font-size:16px">Your students</b><button onClick="{{ goStudents }}" style="${LINK}">All students</button></div>
      <div style="display:grid;gap:6px">
        <sc-for list="{{ studs }}" as="st" hint-placeholder-count="0">
          <button onClick="{{ st.pick }}" style="display:flex;gap:12px;align-items:center;padding:8px;border:0;border-radius:12px;background:transparent;color:var(--gl-ink);cursor:pointer;text-align:left" style-hover="background:var(--gl-soft)">
            <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ st.name }}" src="{{ st.photo }}" size="{{ 36 }}" hint-size="36px,36px"></x-import>
            <div style="min-width:0;flex:1"><div style="font-weight:700;font-size:13.5px">{{ st.name }}</div><div style="font-size:12px;color:var(--gl-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ st.goal }}</div></div>
            <span style="font-size:11.5px;color:var(--gl-faint);white-space:nowrap">{{ st.next }}</span>
          </button>
        </sc-for>
        <sc-if value="{{ lv.studsEmpty }}">${EMPTY('users', 'No students yet. Global Link will match students with you.')}</sc-if>
      </div>
    </x-import>
  </div>
</div>
</sc-if>
<sc-if value="{{ DEMO }}">`;

export const LIVE_SCREENS = [
  // Shell: active tab marker (phone tab bar), real links in the sidebar menu, demo-only role switch.
  [r`data-tour="nav-{{ it.id }}"`, r`data-tour="nav-{{ it.id }}" data-on="{{ it.on }}"`],
  [/<a href="#"( style="display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:9px;color:var\(--gl-ink\);font-weight:600;font-size:13px" style-hover="background:var\(--gl-tint\)"><x-import component-from-global-scope="GLIcon" n="external-link" s="15" hint-size="15px,15px"><\/x-import>Open globallink.com<\/a>)/,
   (m, rest) => '<a href="{{ siteUrl }}" target="_blank" rel="noopener"' + rest],
  [/<button onClick="\{\{ switchRole \}\}"[^\n]*?<\/button>/, m => '<sc-if value="{{ DEMO }}">' + m + '</sc-if>'],
  // Home and Today: live versions in front, demo markup kept behind {{ DEMO }}.
  [r`<sc-if value="{{ P.home }}">`, r`<sc-if value="{{ P.home }}">` + HOME],
  [r`</sc-if>

<sc-if value="{{ P.today }}">`, r`</sc-if></sc-if>

<sc-if value="{{ P.today }}">` + TODAY],
  [r`</sc-if>
<sc-if value="{{ P.schedule }}">`, r`</sc-if></sc-if>
<sc-if value="{{ P.schedule }}">`],
  ...MORE_SCREENS,
];
