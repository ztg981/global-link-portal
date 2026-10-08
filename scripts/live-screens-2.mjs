// More LIVE markup: empty states, live classes, admin extras, lesson room text.
// Text that named the sample people is bound to {{ T.* }}: the design's exact
// words in DEMO, neutral words for real accounts (see live-methods.mjs).
const r = String.raw;
const BOX = r`padding:22px;text-align:center;color:var(--gl-muted);border:1px dashed var(--gl-line);border-radius:18px;font-size:13.5px;line-height:1.5`;
const CARD = r`padding:20px;border-radius:var(--gl-r-card);background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card)`;
const ICON = (n, s = 22) => r`<x-import component-from-global-scope="GLIcon" n="${n}" s="${s}" hint-size="${s}px,${s}px"></x-import>`;
const BIG_EMPTY = (icon, title, body, actions) => r`<div style="${CARD};display:grid;justify-items:center;gap:12px;text-align:center;padding:48px 24px;animation:gl-rise .5s var(--gl-ease-out)">
  <span style="width:56px;height:56px;border-radius:16px;background:var(--gl-tint);color:var(--gl-blue);display:grid;place-items:center">${ICON(icon, 26)}</span>
  <b style="font-size:18px;letter-spacing:-.01em">${title}</b>
  <p style="margin:0;max-width:440px;color:var(--gl-muted);line-height:1.6">${body}</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${actions}</div>
</div>`;
const BTN = (label, fn, variant = 'primary') => r`<x-import component-from-global-scope="GlobalLinkUI.Button" variant="${variant}" size="sm" onClick="{{ ${fn} }}" hint-size="160px,38px">${label}</x-import>`;

const LIVE_CLASSES = r`<sc-if value="{{ LIVE }}">
<sc-if value="{{ noClasses }}">${BIG_EMPTY('graduation-cap', 'Your classes show up here', 'Each mentor you learn with becomes a class, with your lessons and their notes in one place.', '<sc-if value="{{ lv.noMentors }}">' + BTN('Request a mentor', 'openReqHome') + '</sc-if><sc-if value="{{ lv.hasMentors }}">' + BTN('Book a lesson', 'bookHome') + '</sc-if>')}</sc-if>
<sc-if value="{{ hasClasses }}">
<div data-screen-label="Classes" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px;align-items:start;animation:gl-rise .5s var(--gl-ease-out)">
  <div style="display:grid;gap:10px;max-width:340px">
    <sc-for list="{{ classes }}" as="c" hint-placeholder-count="0">
      <button onClick="{{ c.pick }}" style="display:grid;gap:12px;padding:14px;border-radius:18px;border:1.5px solid {{ c.bd }};background:{{ c.bg }};color:var(--gl-ink);cursor:pointer;text-align:left;transition:transform .2s,box-shadow .2s" style-hover="transform:translateY(-2px);box-shadow:var(--gl-shadow-hover)">
        <div style="display:flex;gap:12px;align-items:center">
          <span style="width:42px;height:42px;border-radius:12px;background:var(--gl-tint);color:var(--gl-blue);display:grid;place-items:center;flex:none"><x-import component-from-global-scope="GLIcon" n="{{ c.icon }}" s="20" hint-size="20px,20px"></x-import></span>
          <span style="min-width:0;flex:1;line-height:1.3"><b style="display:block">{{ c.name }}</b><span style="font-size:12px;color:var(--gl-muted)">with {{ c.mentor }}</span></span>
          <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ c.mentor }}" src="{{ c.photo }}" size="{{ 28 }}" hint-size="28px,28px"></x-import>
        </div>
        <div style="font-size:12px;color:var(--gl-muted)">{{ c.done }} lesson(s) · next: {{ c.when }}</div>
      </button>
    </sc-for>
  </div>
  <div style="grid-column:span 2;min-width:0;display:grid;gap:16px">
    <x-import component-from-global-scope="GlobalLinkUI.Card" padding="md" hint-size="100%,400px">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
        <x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ cls.mentor }}" src="{{ cls.photo }}" size="{{ 48 }}" hint-size="48px,48px"></x-import>
        <div style="flex:1;min-width:0"><b style="font-size:20px;letter-spacing:-.02em">{{ cls.name }}</b><div style="font-size:13px;color:var(--gl-muted)">with {{ cls.mentor }} · {{ cls.when }}</div></div>
        <x-import component-from-global-scope="GlobalLinkUI.Button" variant="soft" size="sm" onClick="{{ bookHome }}" hint-size="130px,38px">Book a lesson</x-import>
      </div>
      <div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;color:var(--gl-faint);margin-bottom:8px">LESSONS</div>
      <div style="display:grid;gap:10px">
        <sc-for list="{{ clsLessons }}" as="ls" hint-placeholder-count="0">
          <div style="display:grid;gap:10px;padding:12px 14px;border-radius:14px;background:var(--gl-soft);border:1px solid var(--gl-line)">
            <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><b style="font-size:14px">{{ ls.title }}</b><span style="font-size:12px;color:var(--gl-muted)">{{ ls.when }} · {{ ls.state }}</span></div>
            <sc-if value="{{ ls.hasFb }}"><x-import component-from-global-scope="GlobalLinkUI.StickyNote" color="{{ ls.fbColor }}" tilt="{{ -1 }}" hint-size="100%,80px">{{ ls.fb }}<span style="display:block;font-size:15px;opacity:.7;margin-top:4px">{{ cls.mentor }}</span></x-import></sc-if>
          </div>
        </sc-for>
        <sc-if value="{{ clsLessonsEmpty }}"><div style="${BOX}">No lessons in this class yet.</div></sc-if>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;border:1px dashed var(--gl-line);font-size:12.5px;color:var(--gl-muted)">${ICON('info', 15)}Recordings, transcripts and recaps arrive with video lessons. Your mentor’s notes show up here after each lesson.</div>
    </x-import>
  </div>
</div>
</sc-if>
</sc-if>
<sc-if value="{{ DEMO }}">`;

const LIVE_NOW = r`<sc-if value="{{ LIVE }}"><section style="padding:18px;border-radius:var(--gl-r-card);background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card);display:grid;gap:10px">
        <div style="display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;letter-spacing:.08em;color:var(--gl-faint)"><span style="width:8px;height:8px;border-radius:50%;background:#e5484d"></span>LIVE NOW</div>
        <sc-for list="{{ aLive }}" as="lv2" hint-placeholder-count="0"><div style="display:flex;gap:10px;align-items:center"><x-import component-from-global-scope="GlobalLinkUI.Avatar" name="{{ lv2.who }}" size="{{ 34 }}" hint-size="34px,34px"></x-import><span style="line-height:1.3"><b style="font-size:13px;display:block">{{ lv2.who }}</b><span style="font-size:12px;color:var(--gl-muted)">{{ lv2.cls }}</span></span></div></sc-for>
        <sc-if value="{{ aNoLive }}"><span style="font-size:13px;color:var(--gl-muted)">No lessons happening right now.</span></sc-if>
      </section>
      <sc-if value="{{ aHasSupport }}"><section style="padding:18px;border-radius:var(--gl-r-card);background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card);display:grid;gap:8px">
        <b style="font-size:15px">Messages to the team</b>
        <sc-for list="{{ aSupport }}" as="sm" hint-placeholder-count="0"><button onClick="{{ sm.open }}" style="display:grid;gap:2px;padding:8px;border:0;border-radius:10px;background:transparent;color:var(--gl-ink);cursor:pointer;text-align:left" style-hover="background:var(--gl-soft)"><b style="font-size:13px">{{ sm.name }} <span style="font-weight:500;color:var(--gl-faint)">· {{ sm.when }}</span></b><span style="font-size:12.5px;color:var(--gl-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ sm.text }}</span></button></sc-for>
      </section></sc-if></sc-if>`;

const COMPOSE = r`
      <sc-if value="{{ aMsgOpen }}"><div style="padding:14px;border-radius:14px;border:1px solid var(--gl-blue-soft);background:var(--gl-tint);display:grid;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:13.5px">Message as the Global Link team</b><button onClick="{{ aMsgClose }}" title="Close" style="border:0;background:none;color:var(--gl-muted);cursor:pointer">${ICON('x', 15)}</button></div>
        <div style="display:grid;gap:6px;max-height:220px;overflow:auto">
          <sc-for list="{{ aMsgThread }}" as="tm" hint-placeholder-count="0"><div style="justify-self:{{ tm.align }};max-width:85%;padding:8px 10px;border-radius:12px;font-size:13px;background:var(--gl-card);border:1px solid var(--gl-line)"><sc-if value="{{ tm.them }}"><b style="font-size:11px;color:var(--gl-faint);display:block">THEM</b></sc-if>{{ tm.t }}</div></sc-for>
        </div>
        <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Message" multiline="{{ true }}" value="{{ aMsgText }}" onChange="{{ setAMsgText }}" placeholder="Hi! Just checking in…" hint-size="100%,110px"></x-import>
        <x-import component-from-global-scope="GlobalLinkUI.Button" variant="primary" size="sm" onClick="{{ aMsgSend }}" hint-size="100px,38px">Send</x-import>
      </div></sc-if>`;

const PROFILE_FIELDS = r`
          <sc-if value="{{ LIVE }}"><sc-if value="{{ isStudentRole }}">
            <x-import component-from-global-scope="GlobalLinkUI.TextField" label="My goal" multiline="{{ true }}" value="{{ goalText }}" onChange="{{ setGoal }}" placeholder="Speak confidently in my first college interview." hint="Your mentors see this. Saved automatically." hint-size="100%,140px"></x-import>
            <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Interests" value="{{ interestsText }}" onChange="{{ setInterests }}" placeholder="Hiking, photography, baking" hint="Separate with commas. Mentors use these to plan lessons." hint-size="100%,90px"></x-import>
          </sc-if><sc-if value="{{ isTutorRole }}">
            <x-import component-from-global-scope="GlobalLinkUI.TextField" label="What I teach" value="{{ teachesText }}" onChange="{{ setTeaches }}" placeholder="English conversation, IELTS, SAT math" hint="Used to match you with students. Separate with commas." hint-size="100%,90px"></x-import>
            <x-import component-from-global-scope="GlobalLinkUI.TextField" label="Why I mentor" multiline="{{ true }}" value="{{ whyText }}" onChange="{{ setWhy }}" placeholder="I love helping students feel comfortable speaking English." hint="Students see this on your card. Saved automatically." hint-size="100%,140px"></x-import>
          </sc-if></sc-if>`;

export const MORE_SCREENS = [
  // Schedule: "nothing booked" also for an empty current week.
  [r`<sc-if value="{{ notThisWeek }}"><p style="margin:14px 0 0;color:var(--gl-muted);text-align:center">`, r`<sc-if value="{{ weekEmptyMsg }}"><p style="margin:14px 0 0;color:var(--gl-muted);text-align:center">`],
  // Classes.
  [r`<sc-if value="{{ P.classes }}">`, r`<sc-if value="{{ P.classes }}">` + LIVE_CLASSES],
  [r`</div>
<sc-if value="{{ recapFull }}">`, r`</div>
</sc-if>
<sc-if value="{{ recapFull }}">`],
  // Materials: the SAT practice set card is sample content.
  [/(      <section style="flex:999 1 420px;min-width:0;padding:20px;[^\n]*\n[^\n]*SAT 数学练习(?:[^\n]*\n)*?      <\/section>)/, m => '<sc-if value="{{ DEMO }}">' + m + '</sc-if>'],
  [r`>Nothing matches that yet.</div></sc-if>`, r`>{{ T.matsEmpty }}</div></sc-if>`],
  // Ask a mentor: text answers, empty states.
  [r`<sc-if value="{{ q.answered }}">
          <button onClick="{{ q.play }}"`, r`<sc-if value="{{ q.showPlay }}">
          <button onClick="{{ q.play }}"`],
  [/(<b style="[^"]*">"\{\{ q\.q \}\}"<\/b>)/, m => m + r`<sc-if value="{{ q.hasAns }}"><span style="display:block;margin:4px 0;font-size:13.5px;line-height:1.5;padding:8px 10px;border-radius:10px;background:var(--gl-soft)">{{ q.ans }}</span></sc-if>`],
  [r`    </sc-for>
    <p style="margin:2px 0 0;font-size:12.5px;color:var(--gl-faint);display:flex;align-items:center;gap:6px"><x-import component-from-global-scope="GLIcon" n="shield-check"`,
   r`    </sc-for>
    <sc-if value="{{ qsEmpty }}"><div style="${BOX}">You haven’t asked anything yet. Ask any mentor a question and get a reply, usually within a day.</div></sc-if>
    <p style="margin:2px 0 0;font-size:12.5px;color:var(--gl-faint);display:flex;align-items:center;gap:6px"><x-import component-from-global-scope="GLIcon" n="shield-check"`],
  [r`          </div>
        </x-import>
      </sc-for>`, r`          </div>
        </x-import>
      </sc-for>
      <sc-if value="{{ sharedEmpty }}"><div style="${BOX}">No shared answers yet. When students share their questions, the answers show up here.</div></sc-if>`],
  // Progress.
  [r`minutes you talked, per week</span></div>`, r`minutes you talked, per week</span></div><sc-if value="{{ weeksEmpty }}"><p style="margin:8px 0 0;font-size:13px;color:var(--gl-muted)">Your lesson minutes show up here after your first lesson.</p></sc-if>`],
  [r`{{ wordCount }}</span></div>`, r`{{ wordCount }}</span></div><sc-if value="{{ wordsEmpty }}"><p style="margin:8px 0 0;font-size:13px;color:var(--gl-muted)">Save words from Lumi chats and lessons. They collect here.</p></sc-if>`],
  [r`What your mentors noticed</b>`, r`What your mentors noticed</b><sc-if value="{{ notesEmpty }}"><p style="margin:8px 0 0;font-size:13px;color:var(--gl-muted)">After your lessons, your mentors’ notes show up here.</p></sc-if>`],
  [r`Tell us your test date, your latest score and your goal. David builds your practice around it, and every practice test you log updates this page.`, r`{{ T.satSetup }}`],
  [r`No problem. David will send a 30-minute diagnostic test. Your score shows up here when you finish.`, r`{{ T.satDiag }}`],
  [r`Ask David to cover it next lesson`, r`{{ T.satAsk }}`],
  // My mentors.
  [r`    </sc-for>
  </div>
  <div style="padding:16px;border-radius:18px;background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card);padding:20px;display:grid;gap:14px">`,
   r`    </sc-for>
    <sc-if value="{{ mentorsEmpty }}"><div style="${BOX}">No mentors yet. Request one below and we’ll match you with a bilingual American mentor, usually within two days.</div></sc-if>
  </div>
  <div style="padding:16px;border-radius:18px;background:var(--gl-card);border:1px solid var(--gl-line);box-shadow:var(--gl-shadow-card);padding:20px;display:grid;gap:14px">`],
  [/(\n    <p style="margin:0;font-size:12\.5px;color:var\(--gl-faint\);display:flex;align-items:center;gap:6px"><x-import component-from-global-scope="GLIcon" n="archive")/, m => r`
    <sc-if value="{{ pastEmpty }}"><div style="${BOX}">No past mentors yet.</div></sc-if>` + m],
  // Community.
  [/(      <div style="padding:16px;border-radius:18px;background:var\(--gl-card\);border:1px solid var\(--gl-line\);box-shadow:var\(--gl-shadow-card\);display:grid;gap:10px">\n        <div[^\n]*>NEXT EVENT<\/div>\n(?:[^\n]*\n){2}      <\/div>)/, m => '<sc-if value="{{ hasEvents }}">' + m + '</sc-if>'],
  [r`<sc-for list="{{ events }}" as="ev" hint-placeholder-count="3">`, r`<sc-if value="{{ noEvents }}"><div style="${BOX}">No events yet. Global Link posts live Q&amp;As, clubs and workshops here.</div></sc-if><sc-for list="{{ events }}" as="ev" hint-placeholder-count="3">`],
  [r`>Nothing here yet. Be the first to post.</div></sc-if>`, r`>{{ T.feedEmpty }}</div></sc-if>`],
  // Students (mentor): an empty page until Global Link matches someone.
  [r`<div data-screen-label="Students" style=`, r`<sc-if value="{{ studsEmptyPage }}">${BIG_EMPTY('users', 'No students yet', 'When Global Link matches a student with you, the request shows up here first. Accepted students can book you right away.', BTN('Set my hours', 'goAvail'))}</sc-if>
<sc-if value="{{ showStuds }}"><div data-screen-label="Students" style=`],
  [r`</div>
</sc-if>

<sc-if value="{{ P.questions }}">`, r`</div></sc-if>
</sc-if>

<sc-if value="{{ P.questions }}">`],
  // Settings.
  [r`<x-import component-from-global-scope="GlobalLinkUI.TextField" label="Username" value="{{ username }}" disabled="{{ true }}" hint="Set when you signed up. Change it on the website." hint-size="100%,90px"></x-import>`,
   r`<x-import component-from-global-scope="GlobalLinkUI.TextField" label="Username" value="{{ username }}" disabled="{{ true }}" hint="Set when you signed up. Change it on the website." hint-size="100%,90px"></x-import>` + PROFILE_FIELDS],
  [r`Global Link Portal 0.1.0</b>`, r`Global Link Portal {{ appVersion }}</b>`],
  // Admin overview: live lessons and team inbox instead of the sample lesson card.
  [/(      <section style="padding:18px;[^\n]*gap:10px">\n[^\n]*\n[^\n]*Emma with Chloe[^\n]*\n[^\n]*\n      <\/section>)/, m => '<sc-if value="{{ DEMO }}">' + m + '</sc-if>' + LIVE_NOW],
  // Admin people drawer: message a person as the team.
  [/(<button onClick="\{\{ aSuspend \}\}"[^\n]*\n      <\/div>)/, m => m + COMPOSE],
  // Lesson room text.
  [r`<b>Mia is answering</b>`, r`<b>{{ T.quizWait }}</b>`],
  [r`<b>Mia got it right</b>`, r`<b>{{ T.quizDone }}</b>`],
  [r`Pops up on Mia’s screen with sound and 中文.`, r`{{ T.wordPop }}`],
  [r`Golden Week story map</b><button onClick="{{ toggleScreen }}"`, r`{{ T.slides }}</b><button onClick="{{ toggleScreen }}"`],
  [/>Nice work, Mia!<\/h2><p([^>]*)>You talked for 18 of 40 minutes\. That’s your best yet\.<\/p>/, (m, a) => '>{{ T.endTitle }}</h2><p' + a + '>{{ T.endSub }}</p>'],
  [/>Emma sees this\. It helps her plan next week\.</, '>{{ T.feelNote }}<'],
  [/(<div onClick="\{\{ endNoteOpen \}\}"[^\n]*<\/div>)/, m => '<sc-if value="{{ DEMO }}">' + m + '</sc-if>'],
  [/>Leave Mia a note<\/h2><p([^>]*)>It lands on her home screen as a sticky note\. Short and kind works best\.<\/p>/, (m, a) => '>{{ T.leaveTitle }}</h2><p' + a + '>{{ T.leaveSub }}</p>'],
];
