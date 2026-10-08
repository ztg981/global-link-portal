// Live data layer for the portal.
//
// The design (index.html) was built around sample data for Mia (student) and
// Emma (mentor). Those sample accounts are kept for the admin's Developer page.
// Real accounts load their data from the API, and this file turns it into the
// exact shapes the design's sample constants use, so every screen renders the
// same way, starting empty for a brand-new account.
(function () {
  'use strict';
  var BJ = 'Asia/Shanghai', CA = 'America/Los_Angeles';
  var TOKEN = 'glPortal:token';
  var viewToken = null; // admin "view as" token, memory only

  // ---------- auth + fetch ----------
  function getToken() { if (viewToken) return viewToken; try { return localStorage.getItem(TOKEN) || sessionStorage.getItem(TOKEN); } catch (e) { return null; } }
  function setToken(t, keep) {
    try { localStorage.removeItem(TOKEN); sessionStorage.removeItem(TOKEN); (keep ? localStorage : sessionStorage).setItem(TOKEN, t); } catch (e) {}
  }
  function clearToken() { viewToken = null; try { localStorage.removeItem(TOKEN); sessionStorage.removeItem(TOKEN); } catch (e) {} }
  function api(path, body, opts) {
    opts = opts || {};
    var t = opts.token || getToken();
    var h = { 'content-type': 'application/json' };
    if (t) h.authorization = 'Bearer ' + t;
    return fetch('/api/' + path, { method: opts.method || (body ? 'POST' : 'GET'), headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || ('Request failed (' + r.status + ')')); e.status = r.status; throw e; }
          return j;
        });
      });
  }

  // ---------- time ----------
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function parts(ms, tz) {
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, dow: DOW.indexOf(o.weekday), h: +o.hour % 24, mi: +o.minute };
  }
  function zoned(y, mo, d, h, mi, tz) {
    var want = Date.UTC(y, mo - 1, d, h, mi), g = want;
    for (var i = 0; i < 2; i++) { var p = parts(g, tz); g += want - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi); }
    return g;
  }
  // Hours Beijing is ahead of California right now (15 in summer, 16 in winter).
  function tzGap(at) { var n = at || Date.now(), b = parts(n, BJ), c = parts(n, CA); return Math.round((Date.UTC(b.y, b.mo - 1, b.d, b.h) - Date.UTC(c.y, c.mo - 1, c.d, c.h)) / 3600000); }
  function clock(ms, tz) { var p = parts(ms, tz), h = p.h % 12 || 12; return h + ':' + String(p.mi).padStart(2, '0') + ' ' + (p.h >= 12 ? 'PM' : 'AM'); }
  function dayName(ms, tz) { return DOW[parts(ms, tz).dow]; }
  function dateLabel(ms, tz) { var p = parts(ms, tz); return MON[p.mo - 1] + ' ' + p.d; }
  function dayIndex(ms, tz) { var p = parts(ms, tz); return Math.round(Date.UTC(p.y, p.mo - 1, p.d) / 864e5); }
  // Week grid position of an instant in the viewer's zone, relative to this week's Sunday.
  function weekPos(ms, tz, now) {
    var p = parts(ms, tz), n = parts(now, tz);
    var diff = dayIndex(ms, tz) - (dayIndex(now, tz) - n.dow);
    var wk = Math.floor(diff / 7);
    return { wk: wk, d: diff - wk * 7, h: p.h + p.mi / 60 };
  }
  function relDay(ms, tz, now) {
    var diff = dayIndex(ms, tz) - dayIndex(now, tz);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
    return dayName(ms, tz) + ', ' + dateLabel(ms, tz);
  }
  function ago(ms, now) {
    var s = Math.max(0, ((now || Date.now()) - ms) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 172800) return 'Yesterday'; if (s < 604800) return Math.floor(s / 86400) + ' days ago';
    return dateLabel(ms, BJ);
  }
  function msgTime(ms, tz, now) {
    var diff = dayIndex(now, tz) - dayIndex(ms, tz);
    if (diff === 0) return clock(ms, tz); if (diff < 7) return dayName(ms, tz) + ' ' + clock(ms, tz);
    return dateLabel(ms, tz);
  }
  // Week labels like "Oct 4 – 10, 2026" for the viewer's week at an offset.
  function week(tz, off, now) {
    var n = parts(now, tz);
    var sun = Date.UTC(n.y, n.mo - 1, n.d - n.dow + off * 7, 12);
    var dates = [], a, b;
    for (var i = 0; i < 7; i++) { var d = new Date(sun + i * 864e5); dates.push(d.getUTCDate()); if (!i) a = d; b = d; }
    var label = MON[a.getUTCMonth()] + ' ' + a.getUTCDate() + ' – ' + (a.getUTCMonth() === b.getUTCMonth() ? '' : MON[b.getUTCMonth()] + ' ') + b.getUTCDate() + ', ' + b.getUTCFullYear();
    return { dates: dates, label: label, today: off === 0 ? n.dow : -1 };
  }

  var first = function (n) { return String(n || '').trim().split(/\s+/)[0] || ''; };
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var COLORS = ['pink', 'mint', 'gold', 'blue', 'lavender', 'peach'];
  var NOTE_BG = { pink: ['#ffd9e6', '#5a1f35'], mint: ['#d5f5e3', '#14502f'], gold: ['#fff1b8', '#5b4700'], blue: ['#dcebff', '#14305e'], lavender: ['#e8dcff', '#3b1f6b'], peach: ['#ffe1cc', '#5a2a0e'] };
  function colorFor(id) { var h = 0; String(id).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return COLORS[h % COLORS.length]; }
  var SUBJ_ICON = function (s) { s = String(s || '').toLowerCase(); return /sat|math/.test(s) ? 'calculator' : /pronun/.test(s) ? 'audio-lines' : /ielts/.test(s) ? 'award' : /school|college|essay/.test(s) ? 'school' : /bio|chem|science|ap /.test(s) ? 'flask-conical' : 'messages-square'; };
  var KIND_ICON = { Practice: 'sparkles', Reading: 'book-open', 'Voice note': 'mic', Writing: 'pen-line', Words: 'languages' };

  // ---------- member (student / mentor) ----------
  function mapMember(B, ctx) {
    var me = B.me, tutor = me.role === 'tutor', now = B.now || Date.now();
    var tz = tutor ? CA : BJ, oz = tutor ? BJ : CA, otherCity = tutor ? 'Beijing' : 'California';
    var D = {};
    var st = B.state || {};
    var people = {}; // other users by id -> display record
    function person(id, name, extra) {
      if (!id) return null;
      if (!people[id]) people[id] = Object.assign({ id: id, name: name || 'Someone', first: first(name), photo: '', note: colorFor(id), subj: '', city: '' }, extra || {});
      return people[id];
    }
    var active = B.matches.filter(function (m) { return m.status === 'active'; });
    var ended = B.matches.filter(function (m) { return m.status === 'ended'; });
    active.concat(ended).forEach(function (m) { person(m.otherId, m.name, { subj: cap(m.subject), city: (m.profile && m.profile.city) || '' }); });
    (B.directory || []).forEach(function (d) { person(d.id, d.name, { subj: d.teaches || 'Mentor' }); });
    D.ME_ID = me.id;

    // Lessons (from the portal) and bookings made on the website.
    var lessons = B.lessons.filter(function (l) { return l.status !== 'cancelled'; });
    var upcoming = lessons.filter(function (l) { return l.status === 'scheduled' && l.start + l.dur * 60000 > now; }).sort(function (a, b) { return a.start - b.start; });
    var nextId = upcoming[0] ? upcoming[0].id : null;
    var SESS = lessons.map(function (l) {
      var p = weekPos(l.start, tz, now);
      person(l.otherId, l.name);
      return { id: 'l' + l.id, lessonId: l.id, who: tutor ? l.otherId : me.id, m: tutor ? me.id : (l.otherId || 'gl'), cls: l.cls, topic: l.topic || 'Open conversation', d: p.d, h: p.h, wk: p.wk, dur: l.dur, start: l.start,
        done: l.status === 'done' || l.start + l.dur * 60000 < now, next: l.id === nextId, feedback: l.feedback };
    });
    if (!tutor) (B.bookings || []).forEach(function (b) {
      if (!b.start || b.status === 'cancelled') return;
      var p = weekPos(b.start, tz, now), mid = 'bk' + b.id;
      people[mid] = { id: mid, name: b.mentorName ? b.mentorName + ' (requested)' : 'Global Link', first: b.mentorName ? first(b.mentorName) : 'Global Link', photo: '', note: 'gold', subj: b.cls, city: '' };
      SESS.push({ id: mid, who: me.id, m: mid, cls: b.cls, topic: 'Booked on globallink.com · we’ll confirm your mentor', d: p.d, h: p.h, wk: p.wk, dur: 40, start: b.start, done: b.start < now, next: false, requested: true });
    });
    if (!nextId) { var nb = SESS.filter(function (s) { return s.requested && s.start > now; }).sort(function (a, b) { return a.start - b.start; })[0]; if (nb) nb.next = true; }
    D.SESS = SESS;
    var nx = SESS.filter(function (s) { return s.next; })[0];
    D.nextStart = nx ? nx.start : null;

    // Bookable times from each mentor's weekly hours (California), next 14 days.
    var slots = [];
    if (!tutor) (B.grids || []).forEach(function (g) {
      var c0 = parts(now, CA);
      for (var day = 0; day < 14; day++) {
        var noon = Date.UTC(c0.y, c0.mo - 1, c0.d + day, 12), dd = new Date(noon);
        var dow = dd.getUTCDay();
        for (var h = 0; h < 24; h++) {
          if (!g.avail || !g.avail[dow + '-' + h]) continue;
          var t0 = zoned(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), h, 0, CA);
          if (t0 < now + 30 * 60000) continue;
          var clash = (B.busy || []).some(function (b) { return b.tutorId === g.id && t0 < b.start + b.dur * 60000 && t0 + 40 * 60000 > b.start; })
            || lessons.some(function (l) { return l.status === 'scheduled' && t0 < l.start + l.dur * 60000 && t0 + 40 * 60000 > l.start; });
          if (clash) continue;
          var p = weekPos(t0, tz, now);
          slots.push({ id: 's' + g.id.slice(0, 8) + t0, m: g.id, tutorId: g.id, start: t0, d: p.d, h: p.h, wk: p.wk,
            whenL: relDay(t0, tz, now) + ' · ' + clock(t0, tz), otherL: dayName(t0, oz) + ' ' + clock(t0, oz) + ' in ' + otherCity });
        }
      }
    });
    slots.sort(function (a, b) { return a.start - b.start; });
    // Spread choices across mentors and days: at most 2 a day per mentor, 12 total.
    var perDay = {};
    D.BOOK_SLOTS = slots.filter(function (s) { var k = s.m + dayIndex(s.start, tz); perDay[k] = (perDay[k] || 0) + 1; return perDay[k] <= 2; }).slice(0, 12);

    // Mentors (student) / students (mentor).
    D.MY_MENTOR_IDS = tutor ? [] : active.map(function (m) { return m.otherId; });
    D.MDETAIL = {};
    if (!tutor) active.forEach(function (m) {
      var pr = m.profile || {}, col = colorFor(m.otherId);
      var nl = upcoming.filter(function (l) { return l.otherId === m.otherId; })[0];
      D.MDETAIL[m.otherId] = { role: 'Mentor' + (pr.city ? ' · ' + pr.city : ' · California'), chinese: 'Bilingual', tags: String(pr.teaches || m.subject || 'Conversation').split(/\s*,\s*/).filter(Boolean).slice(0, 3),
        quote: pr.why || 'Happy to help you speak with confidence.', note: 'Hi ' + first(me.name) + '! Message me anytime before our lesson.', noteColor: { bg: NOTE_BG[col][0], fg: NOTE_BG[col][1] }, color: col,
        nextP: nl ? dayName(nl.start, BJ) + ' ' + clock(nl.start, BJ) + ' Beijing' : 'No lesson booked yet', nextS: nl ? dayName(nl.start, CA) + ' ' + clock(nl.start, CA) + ' California' : 'Book a time that works for you' };
    });
    D.PAST = ended.map(function (m) {
      return { id: m.otherId, name: m.name, first: first(m.name), role: 'Mentor', subj: cap(m.subject) || 'Lessons', span: dateLabel(m.since, BJ), ended: 'Finished', quote: '', color: colorFor(m.otherId), note: 'Thanks for learning with me!', noteDate: '', words: 0, avail: 'You can ask to work together again any time.',
        lessons: lessons.filter(function (l) { return l.otherId === m.otherId && l.status === 'done'; }).map(function (l) { var p = parts(l.start, BJ); return [MON[p.mo - 1].toUpperCase(), String(p.d), l.topic || l.cls, l.dur + ' min', 'notes']; }) };
    });
    D.STUDENTS = {};
    D.PLANS = {};
    var prep = st.prepNotes || {};
    if (tutor) active.forEach(function (m) {
      var pr = m.profile || {};
      var ls = lessons.filter(function (l) { return l.otherId === m.otherId; });
      var nl = upcoming.filter(function (l) { return l.otherId === m.otherId; })[0];
      var last = ls.filter(function (l) { return l.status === 'done' || l.start < now; }).sort(function (a, b) { return b.start - a.start; })[0];
      D.STUDENTS[m.otherId] = { id: m.otherId, name: m.name, first: first(m.name), zh: '', photo: '', grade: pr.grade || 'Student', city: pr.city || '', level: cap(m.subject) || '', goal: pr.goal || 'Goal not shared yet',
        interests: (pr.interests && pr.interests.length ? pr.interests : [cap(m.subject) || 'English']).slice(0, 6), last: last ? (last.topic || last.cls) + (last.feedback && last.feedback.text ? '. ' + last.feedback.text : '') : 'No lessons yet.',
        next: nl ? relDay(nl.start, CA, now) + ', ' + clock(nl.start, CA) : 'Not booked', lessons: ls.filter(function (l) { return l.status === 'done'; }).length, prep: prep[m.otherId] || '' };
      D.PLANS[m.otherId] = { plan: 'Plan set by Global Link', used: 0, of: 0, packs: Object.keys(ctx.PACKS) };
    });
    D.TREQS = tutor ? B.matches.map(function (m) {
      var pr = m.profile || {};
      return { id: 'm' + m.id, matchId: m.id, name: m.name, photo: '', sub: [pr.grade, pr.city].filter(Boolean).join(' · ') || 'Student', subj: cap(m.subject) || 'Lessons', status: m.status === 'proposed' ? 1 : 3, date: dateLabel(m.since, CA), via: 'from Global Link', goal: pr.goal || '' };
    }) : [];
    var RSTAT = { new: 1, reviewing: 2, matched: 3 };
    D.REQS = tutor ? [] : B.requests.filter(function (r) { return RSTAT[r.status]; }).map(function (r) {
      return { id: 'r' + r.id, reqId: r.id, name: r.mentorName || (RSTAT[r.status] === 3 ? 'Matched' : 'Finding your mentor…'), photo: '', subj: cap(r.subj), status: RSTAT[r.status], date: dateLabel(r.at, BJ), via: r.via };
    }).concat(active.map(function (m) { return { id: 'a' + m.id, m: m.otherId, status: 3, date: dateLabel(m.since, BJ), via: 'matched by Global Link' }; }));

    // Tasks.
    D.TASKS = B.tasks.map(function (t) {
      var share = (t.sharedWith || []).filter(function (id) { return people[id]; });
      return { id: 't' + t.id, taskId: t.id, title: t.title, cls: tutor ? (t.studentName || t.cls) : t.cls, m: tutor ? null : (t.tutorId || null), mine: !t.tutorId, shareTo: share, shareLabel: share.map(function (id) { return people[id].first; }).join(', '),
        due: t.due || 'No due date', due2: '', kind: t.kind, icon: KIND_ICON[t.kind] || ctx.TI[t.kind] || 'square-check-big', done: t.done, mats: (t.mats || []).map(String), student: t.studentName };
    });

    // Materials (assignments for students).
    var MATS = [], MSTAT = {}, prog = {}, seen = {};
    if (!tutor) B.assignments.forEach(function (a) {
      if (!a.material || seen[a.materialId]) return; seen[a.materialId] = 1;
      var tid = (B.matches.filter(function (m) { return m.name === a.tutorName; })[0] || {}).otherId || 'gl';
      if (!people[tid]) people[tid] = { id: tid, name: a.tutorName || 'Global Link', first: first(a.tutorName) || 'Global Link', photo: '', note: 'blue' };
      MATS.push({ id: a.materialId, asgId: a.id, title: a.material.title, kind: a.material.type, icon: ctx.TI[a.material.type] || 'file-text', cls: cap(ctx.PACKS[a.material.pack] ? ctx.PACKS[a.material.pack][0] : 'Materials'), from: tid,
        date: dateLabel(a.at, BJ), size: (a.material.blocks || []).length + ' blocks', blocks: a.material.blocks || [], note: a.note });
      MSTAT[a.materialId] = { asg: true, due: a.due || 'No due date' };
      prog[a.materialId] = a.progress || (a.opened ? 0 : 0);
    });
    D.MATS = MATS; D.MSTAT = MSTAT; D.matProg = prog;

    // Classes = one per mentor you learn with.
    D.CLASSES = tutor ? [] : active.map(function (m) {
      var ls = lessons.filter(function (l) { return l.otherId === m.otherId; });
      var done = ls.filter(function (l) { return l.status === 'done' || (l.status === 'scheduled' && l.start + l.dur * 60000 < now); }).length;
      var nl = upcoming.filter(function (l) { return l.otherId === m.otherId; })[0];
      return { id: 'c' + m.id, name: cap(m.subject) || 'English Conversation', zh: '', m: m.otherId, when: nl ? dayName(nl.start, BJ) + 's, ' + clock(nl.start, BJ) : 'Not booked yet', done: done, of: Math.max(done + (nl ? 1 : 0), 1), icon: SUBJ_ICON(m.subject),
        lessons: ls.sort(function (a, b) { return b.start - a.start; }).map(function (l) { return { id: l.id, title: l.topic || l.cls, when: relDay(l.start, BJ, now) + ' · ' + clock(l.start, BJ), done: l.status === 'done' || l.start < now, feedback: l.feedback }; }) };
    });

    // Messages.
    var TH = B.threads.map(function (t) {
      var who = t.id === 'team' ? null : people[t.id] || person(t.id, t.name);
      var match = B.matches.filter(function (m) { return m.otherId === t.id; })[0];
      var msgs = t.msgs.map(function (m) { return { id: m.id, me: m.me, t: m.t, time: msgTime(m.at, tz, now), at: m.at, mats: m.mats || undefined }; });
      if (t.id === 'team' && !msgs.length) msgs = [{ me: false, t: 'Welcome to Global Link, ' + first(me.name) + '! Message us here any time about your account, plans or lessons.', time: msgTime(Date.parse(me.createdAt) || now, tz, now), at: 0 }];
      return { id: t.id, name: t.name, photo: t.id === 'team' ? 'assets/gl-mark.png' : '', sub: t.id === 'team' ? (tutor ? 'Mentor support' : 'Account and bookings') : (match ? cap(match.subject) : (t.role === 'tutor' ? 'Mentor' : 'Student')),
        local: t.id === 'team' ? '' : dayName(now, oz) + ' ' + clock(now, oz) + ' in ' + otherCity, reply: t.id === 'team' ? 'We reply within a day' : '', unread: t.msgs.filter(function (m) { return m.unread; }).length, msgs: msgs, canSend: t.partner, last: msgs.length ? msgs[msgs.length - 1].at : 0 };
    }).sort(function (a, b) { return (a.id === 'team') - (b.id === 'team') || b.last - a.last; });
    D.TH = TH;

    // Questions.
    if (tutor) {
      D.TQ = B.questions.filter(function (q) { return !q.answer; }).map(function (q) {
        person(q.otherId, q.name);
        var left = Math.max(0, q.at + 72 * 3600000 - now), pct = Math.min(1, (now - q.at) / (72 * 3600000));
        return { id: 'q' + q.id, qid: q.id, from: q.otherId, q: q.q, type: q.kind === 'video' ? 'Video reply' : 'Text reply', left: left > 86400000 ? Math.floor(left / 86400000) + ' days left' : Math.ceil(left / 3600000) + 'h left', pct: pct, asked: 'Asked ' + ago(q.at, now) };
      });
      D.QS = [];
    } else {
      D.QS = B.questions.map(function (q) {
        person(q.otherId, q.name);
        var due = q.at + 72 * 3600000;
        return { id: 'q' + q.id, to: q.otherId, q: q.q, type: q.kind === 'video' ? 'Video reply' : 'Text reply', answered: !!q.answer, ans: q.answer || '', len: 'Text', by: dayName(due, BJ) + ' ' + clock(due, BJ), by2: dayName(due, CA) + ' ' + clock(due, CA) + ' in California', pct: Math.min(1, (now - q.at) / (72 * 3600000)), asked: 'Asked ' + ago(q.at, now) };
      });
      D.TQ = [];
    }
    D.SHARED = (B.sharedQs || []).map(function (q) { person(q.tutorId, q.tutorName); return { id: q.id, from: q.from, to: q.tutorId, q: q.q, type: q.kind === 'video' ? 'Video reply' : 'Text reply', ans: q.ans, len: '' }; });

    // Notifications derived from recent activity.
    var N = [];
    TH.forEach(function (t) { if (t.unread) { var lm = t.msgs[t.msgs.length - 1]; N.push({ id: 'nm' + t.id, icon: 'message-circle', t: t.name + ' sent you a message', s: String(lm.t).slice(0, 60), time: lm.time, unread: true, at: lm.at }); } });
    if (nx && nx.start - now < 86400000) N.push({ id: 'nl', icon: 'video', t: 'Lesson ' + relDay(nx.start, tz, now).toLowerCase() + ' at ' + clock(nx.start, tz), s: nx.cls + ' with ' + ((people[tutor ? nx.who : nx.m] || {}).name || 'your mentor'), time: 'soon', unread: true, at: nx.start });
    if (!tutor) D.QS.filter(function (q) { return q.answered; }).slice(0, 2).forEach(function (q) { N.push({ id: 'nq' + q.id, icon: 'message-square-text', t: (people[q.to] || {}).first + ' answered your question', s: q.q.slice(0, 60), time: '', unread: false, at: 0 }); });
    if (tutor && D.TQ.length) N.push({ id: 'ntq', icon: 'inbox', t: D.TQ.length + ' question' + (D.TQ.length === 1 ? '' : 's') + ' waiting for you', s: D.TQ[0].q.slice(0, 60), time: '', unread: true, at: now });
    if (tutor) D.TREQS.filter(function (r) { return r.status === 1; }).forEach(function (r) { N.push({ id: 'nr' + r.id, icon: 'user-plus', t: r.name + ' would like lessons with you', s: r.subj, time: '', unread: true, at: now }); });
    if (!N.length) N.push({ id: 'n0', icon: 'sparkles', t: 'Welcome to Global Link', s: tutor ? 'Set your hours in Availability so students can book you.' : 'Request a mentor to get started.', time: '', unread: false, at: 0 });
    D.NOTIF = N.sort(function (a, b) { return b.at - a.at; }).slice(0, 8);

    // Library (mentor).
    D.LIB = []; D.MYMATS = []; D.tAssigned = [];
    if (tutor) {
      B.library.forEach(function (m) {
        if (m.ownerId === me.id) D.MYMATS.push({ id: m.id, title: m.title, type: m.type, pack: m.pack, level: m.level, by: me.name, status: m.status, when: ago(m.at, now), blocks: m.blocks });
        else D.LIB.push({ id: m.id, title: m.title, kind: m.type, icon: ctx.TI[m.type] || 'file-text', pack: ctx.PACKS[m.pack] ? m.pack : 'free', size: m.blocks.length + ' blocks', src: m.by === 'Global Link' ? 'Global Link' : 'Global Link · by ' + first(m.by), blocks: m.blocks });
      });
      D.tAssigned = B.assignments.map(function (a) { var o = {}; o[a.studentId] = a.opened; return { id: 'a' + a.id, asgId: a.id, mat: a.materialId, to: [a.studentId], due: a.due || 'No due date', when: ago(a.at, now), note: a.note, opened: o }; });
    }

    // Community.
    var GN = {}; ctx.GROUPS.forEach(function (g) { GN[g.id] = g.name; });
    D.liked = {};
    D.POSTS = (B.posts || []).map(function (p) {
      if (p.liked) D.liked[p.id] = true;
      return { id: p.id, author: p.author, photo: p.team ? 'assets/gl-mark.png' : '', mentor: p.mentor, sub: p.team ? 'Announcement' : p.mentor ? 'Mentor' : 'Student', group: GN[p.group] || 'Everyone', type: p.type, time: ago(p.at, now), title: p.title, body: p.body,
        likes: p.likes - (p.liked ? 1 : 0), comments: p.comments.map(function (c) { return { who: c.who, photo: '', mentor: c.mentor, t: c.t }; }) };
    });
    D.GROUPS = ctx.GROUPS.map(function (g) { return Object.assign({}, g, { members: (B.groupCounts || {})[g.id] || 0 }); });
    D.MEMBERS = B.members || 0;
    D.EVENTS = [];

    D.MENTORS = people;
    D.TZD = tzGap(now);
    var wk0 = week(tz, 0, now);
    D.week = function (off) { return week(tz, off, now); };
    D.DATES = wk0.dates; D.today = wk0.today;
    D.clockA = { t: clock(now, tz), city: tutor ? 'California' : 'Beijing' };
    D.clockB = { t: clock(now, oz), city: otherCity };
    D.hourNow = parts(now, tz).h + parts(now, tz).mi / 60;
    D.relLabel = function (ms) { return relDay(ms, tz, Date.now()); };
    D.clock = function (ms, which) { return clock(ms, which === 'other' ? oz : tz); };
    D.otherAt = function (ms) { var a = parts(ms, tz), b = parts(ms, oz); return (a.d !== b.d ? dayName(ms, oz) + ' ' : '') + clock(ms, oz) + ' in ' + otherCity; };
    return D;
  }

  // ---------- admin ----------
  function mapAdmin(A, ctx) {
    var now = A.now || Date.now(), D = {};
    var people = {};
    A.users.forEach(function (u) { if (u.role === 'Mentor') people[u.id] = { id: u.id, name: u.name, first: first(u.name), photo: '', note: colorFor(u.id), subj: 'Mentor', city: u.loc }; });
    D.MENTORS = people;
    D.USERS = A.users.map(function (u) {
      return { id: u.id, name: u.name, role: u.role, photo: '', loc: u.loc || (u.username ? '@' + u.username : ''), plan: u.plan, credits: u.credits, status: u.status, last: u.lastSeen ? ago(u.lastSeen, now) : 'Never', joined: dateLabel(u.joined, BJ), email: u.email, username: u.username, note: u.note };
    });
    D.notes = {}; A.users.forEach(function (u) { if (u.note) D.notes[u.id] = u.note; });
    D.MQ = A.queue.map(function (q) {
      return { id: 'q' + q.id, reqId: q.id, name: q.name, photo: '', sub: q.sub, subj: cap(q.subj), times: q.via === 'website' ? 'from globallink.com' : 'from the portal', goal: q.note || q.goal || 'No note', wait: ago(q.at, now).replace(' ago', ''),
        sugg: q.sugg.map(function (s) { return [s.id, s.score, s.why]; }) };
    });
    D.MOD = A.reports.map(function (r) { return { id: r.id, reason: r.reason, where: r.where.replace(/g\d/, function (g) { var x = ctx.GROUPS.filter(function (y) { return y.id === g; })[0]; return x ? x.name : g; }), reports: r.reports, author: r.author, text: r.text }; });
    var ST = { scheduled: 'Scheduled', cancelled: 'Cancelled', done: 'Done', no_show: 'No-show' };
    D.LESSONS = A.lessons.filter(function (l) { return l.status !== 'cancelled' || l.start > now - 86400000; }).map(function (l) {
      var live = l.status === 'scheduled' && l.start <= now && now < l.start + l.dur * 60000;
      var lbl = live ? 'Live' : l.status === 'scheduled' && l.start + l.dur * 60000 < now ? 'Done' : ST[l.status] || 'Scheduled';
      return [relDay(l.start, BJ, now).replace('Today', '') + (relDay(l.start, BJ, now) === 'Today' ? '' : ' ') + clock(l.start, BJ), dayName(l.start, CA) + ' ' + clock(l.start, CA), first(l.tutor), first(l.student), l.cls, lbl, l.id];
    });
    var mine = [], lib = [];
    A.materials.forEach(function (m) {
      if (m.ownerId) mine.push({ id: m.id, title: m.title, type: m.type, pack: m.pack, level: m.level, by: m.by, status: m.status, when: ago(m.at, now), blocks: m.blocks });
      else lib.push({ id: m.id, title: m.title, type: m.type, pack: m.pack, level: m.level, by: 'Global Link', status: m.status, uses: m.uses, blocks: m.blocks });
    });
    D.MYMATS = mine; D.ALIB = lib;
    D.AUDIT = A.audit.map(function (a) { return { t: a.t, icon: a.icon, by: a.by, time: ago(a.at, now) }; });
    var c = A.config;
    D.flags = c.flags; D.maint = c.maint; D.announce = c.announce; D.annHist = c.annHist || []; D.modRules = c.modRules;
    D.PKG = (c.pkgs || []).map(function (p) { return Object.assign({ sold: 0 }, p); });
    D.signups = [];
    for (var i = 6; i >= 0; i--) { var t = now - i * 86400000, p = parts(t, BJ); var key = p.y + '-' + String(p.mo).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'); D.signups.push({ l: DOW[p.dow], v: A.signups[key] || 0 }); }
    D.support = A.support;
    D.clockA = { t: clock(now, BJ), city: 'Beijing' }; D.clockB = { t: clock(now, CA), city: 'California' };
    D.TZD = tzGap(now);
    return D;
  }

  window.GLLive = { api: api, getToken: getToken, setToken: setToken, clearToken: clearToken, setViewToken: function (t) { viewToken = t; },
    mapMember: mapMember, mapAdmin: mapAdmin, parts: parts, zoned: zoned, clock: clock, ago: ago, tzGap: tzGap, BJ: BJ, CA: CA, first: first,
    greeting: function (tz) { var h = parts(Date.now(), tz).h; return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; } };
})();
