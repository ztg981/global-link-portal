// Exact-match patches for the design's component script. Each [from, to, count?].
// Demo behaviour is unchanged; LIVE branches use the API through live.js.
export { MODE_CODE, METHODS } from './live-methods.mjs';
const r = String.raw;

export const SCRIPT_PATCHES = [
  // Grid hours follow the real lessons; Beijing/California gap is live (15 or 16 hours).
  [r`const SH=t=>t?[13,23]:[7,15];`, r`const SH=t=>SH_LIVE||(t?[13,23]:[7,15]);`],

  // No prefilled demo credentials; sign-in fields for 2FA and "keep me signed in".
  [r`email:'mia.lin@example.com',pw:'password1',signErr:''`, r`email:'',pw:'',otp:'',needOtp:false,keep:true,signErr:''`],

  // Start: resume a saved session, else the sign-in screen.
  [r`this.loadPrefs();if(start==='signin')this.setState({stage:'signin'});else this.enterApp(start==='tutor'?'tutor':'student');`,
   r`this._init0={...this.state};this.loadPrefs();if(start==='signin')this.resume();else this.enterApp(start==='tutor'?'tutor':'student');`],

  // Poll the server for new messages and changes.
  [r`    const c=this.state.call;if(c&&c.phase==='live')this.callEvents(c.secs);`,
   r`    const c=this.state.call;if(c&&c.phase==='live')this.callEvents(c.secs);
    if(LIVE&&this.state.stage==='app'&&Date.now()-(this._lastPoll||0)>25000){this._lastPoll=Date.now();this.poll();}`],
  // Scripted lesson-room moments are part of the demo only.
  [r`  callEvents(t){
    const isT=this.state.role==='tutor';`, r`  callEvents(t){
    if(LIVE)return;const isT=this.state.role==='tutor';`],

  // Translation and Lumi go through the server (Gemini keys, then OpenRouter).
  [r`(async()=>{let r='';try{if(window.claude&&window.claude.complete)r=await window.claude.complete({messages:[{role:'user',content:'Translate this message into '+(cjk?'natural, friendly English':'natural, friendly Simplified Chinese')+'. Keep line breaks. Reply with only the translation.\n\n'+text}]});}catch(e){}`,
   r`(async()=>{let r='';try{r=(await GLLive.api('portal/translate',{text})).text;}catch(e){}`],
  [r`    try{if(window.claude&&window.claude.complete){reply=await window.claude.complete({messages:[{role:'user',content:'You are Lumi, the friendly AI helper inside the Global Link learning app. You help a Chinese high-school student named Mia practice English between lessons with American mentors. Reply in 1-3 short, warm sentences of simple English. Gently correct one mistake if there is one (show the better phrasing), then ask one follow-up question. If she writes Chinese, answer in English and add a short Chinese hint. No emoji.\n\nConversation so far:\n'+msgs.map(m=>(m.from==='bot'?'Lumi: ':'Mia: ')+m.t).join('\n')+'\nLumi:'}]});}}catch(e){}
    if(!reply)reply='Nice! A small tip: say "I went hiking with my family" instead of "I go hiking". What was your favorite moment?';`,
   r`    try{reply=(await GLLive.api('portal/lumi',{messages:msgs.slice(-12).map(m=>({role:m.from==='bot'?'assistant':'user',content:m.t}))})).text;}catch(e){if(e&&e.status===429)reply=e.message;}
    if(!reply)reply=LIVE?'Lumi is resting for a moment. Please try again soon.':'Nice! A small tip: say "I went hiking with my family" instead of "I go hiking". What was your favorite moment?';`],

  // Admin can always go back to the console from any account view.
  [r`  go(p){this.setState({page:p,`, r`  go(p){if(String(p).startsWith('a_')&&this.state.role!=='admin')return;this.setState({page:p,`],

  // Sign in against the shared globallink.com accounts (admin is checked on the server).
  [r`  signIn(){const u=(this.state.email||'').trim(),pw=this.state.pw||'';
    if(u.toLowerCase()==='admin718'){if(pw==='[redacted]'||pw==='[redacted]'){this.startSync('admin');}else{this.setState({signErr:'That password doesn’t match Admin718.'});}return;}
    if(!u.includes('@')&&!/^[a-z0-9._-]{3,}$/i.test(u)){this.setState({signErr:'Please use the email you signed up with.'});return;}
    const role=this.state.email.toLowerCase().startsWith('emma')?'tutor':'student';this.startSync(role);}`,
   r`  signIn(){const u=(this.state.email||'').trim(),pw=this.state.pw||'';if(this.state.signing)return;
    if(!u||!pw){this.setState({signErr:'Enter your username or email and your password.'});return;}
    if(this.state.needOtp&&!/^\d{6}$/.test((this.state.otp||'').trim())){this.setState({signErr:'Enter the 6-digit code from your authenticator app.'});return;}
    this.setState({signing:true,signErr:''});
    GLLive.api('auth/login',{login:u,password:pw,otp:this.state.needOtp?(this.state.otp||'').trim():undefined}).then(r=>{
      if(r.needOtp){this.setState({signing:false,needOtp:true,signErr:''});return;}
      GLLive.setToken(r.token,this.state.keep!==false);this.setState({pw:'',otp:'',needOtp:false});return this.startLive(r.user);
    }).catch(e=>this.setState({signing:false,signErr:e.message||'Couldn’t sign in. Check your connection and try again.'}));}`],

  // Lessons in a live account are already in the viewer's own time zone.
  [r`  viewSess(s){const t=this.isT();const [pd,ph]=t?shift(s.d,s.h,-15):[s.d,s.h];const [sd,sh]=t?[s.d,s.h]:shift(s.d,s.h,-15);`,
   r`  viewSess(s){if(LIVE)return this.viewSessLive(s);const t=this.isT();const [pd,ph]=t?shift(s.d,s.h,-TZD):[s.d,s.h];const [sd,sh]=t?[s.d,s.h]:shift(s.d,s.h,-TZD);`],

  // Command palette: demo-only switches stay in the demo.
  [r`...(t?[{label:'Write lesson notes for Mia',hint:'due',icon:'pen-line',run:()=>this.openFeedback()},{label:'Reply to questions',hint:'3 waiting',icon:'inbox',run:()=>this.go('questions')}]`,
   r`...(t?[{label:'Write lesson notes'+(LIVE?'':' for Mia'),hint:'due',icon:'pen-line',run:()=>this.openFeedback()},{label:'Reply to questions',hint:(this.state.tq||[]).length+' waiting',icon:'inbox',run:()=>this.go('questions')}]`],
  [r`      {label:'Dev: switch to '+(t?'student':'mentor')+' account',hint:'dev',icon:'repeat',run:()=>this.switchRole()}];`,
   r`      ...(LIVE?[]:[{label:'Dev: switch to '+(t?'student':'mentor')+' account',hint:'dev',icon:'repeat',run:()=>this.switchRole()}])];`],
  [r`  switchRole(){const t=!this.isT();`, r`  switchRole(){if(LIVE)return;const t=!this.isT();`],
  [r`  openPrejoin(){this.setState({call:{phase:'pre',`,
   r`  openPrejoin(){if(LIVE&&LIVE.kind==='member'){const nx=(this.state.sessions||[]).find(x=>x.next&&!x.requested);if(!nx){this.toast(this.isT()?'No lesson booked yet.':'No lesson booked yet. Book one from your mentor’s open times.','calendar');return;}this._callFor=nx;}this.setState({call:{phase:'pre',`],
  [r`  openFeedback(){this.setState({call:{phase:'end',`,
   r`  openFeedback(){if(LIVE){const last=(this.state.sessions||[]).filter(x=>x.done&&!x.feedback&&x.lessonId).sort((a,b)=>b.start-a.start)[0];if(!last){this.toast('No lessons are waiting for notes.','check');return;}this._callFor=last;}this.setState({call:{phase:'end',`],

  // Messages: send to the server (mentors, students, the Global Link team).
  [r`    const id=this.state[ak];const upd=th=>`,
   r`    const id=this.state[ak];
    if(LIVE){if(LIVE.readOnly){this.toast('You’re viewing this account read-only.','eye');return;}const th=(this.state[key]||[]).find(x=>x.id===id)||(this.state[key]||[])[0];if(!th)return;
      if(th.canSend===false){this.toast('You can message your mentors, your students and the Global Link team.','info');return;}
      this.setState(s=>({[key]:s[key].map(x=>x.id===th.id?{...x,msgs:x.msgs.concat([{me:true,t,time:'now'}])}:x),draft:''}));this.markSetup('hello');this.sync('portal/message',{to:th.id,text:t},true);return;}
    const upd=th=>`],

  // ---- renderVals ----
  [r`const nav=navDef.map((n,i)=>{const active=i===idx;const b=badges[n[0]];return {id:n[0],`, r`const nav=navDef.map((n,i)=>{const active=i===idx;const b=badges[n[0]];return {on:active?'1':'0',id:n[0],`],
  [r`t?'Your students and availability':'Your bookings with Emma, David and Sarah'`, r`t?'Your students and availability':(s.resuming?'Your bookings and lessons':'Your bookings with Emma, David and Sarah')`],
  [r`const hd=HEAD[s.page]||['','',''];`, r`const hd=this.headFor(s.page);`],
  [r`const clockA=t?{t:'6:18 PM',city:'California'}:{t:'9:18 AM',city:'Beijing'};`, r`const clockA=LIVE&&LIVE.D.clockA?LIVE.D.clockA:(t?{t:'6:18 PM',city:'California'}:{t:'9:18 AM',city:'Beijing'});`],
  [r`const clockB=t?{t:'9:18 AM',city:'Beijing'}:{t:'6:18 PM',city:'California'};`, r`const clockB=LIVE&&LIVE.D.clockB?LIVE.D.clockB:(t?{t:'9:18 AM',city:'Beijing'}:{t:'6:18 PM',city:'California'});`],
  [r`const me=t?{name:'Emma Carter',photo:IMG.emma,sub:'Mentor · Palo Alto'}:{name:'Mia Lin',photo:IMG.mia,sub:'Student · Hangzhou'};`,
   r`const me=LIVE&&LIVE.kind==='member'?{name:LIVE.me.name,photo:'',sub:(t?'Mentor':'Student')+(LIVE.me.username?' · @'+LIVE.me.username:'')}:(t?{name:'Emma Carter',photo:IMG.emma,sub:'Mentor · Palo Alto'}:{name:'Mia Lin',photo:IMG.mia,sub:'Student · Hangzhou'});`],
  [r`const mine=s.sessions.filter(x=>t?x.m==='emma':x.who==='mia').map(x=>this.viewSess(x));`,
   r`const mine=s.sessions.filter(x=>t?x.m===ME_ID:x.who===(LIVE?ME_ID:'mia')).map(x=>this.viewSess(x));`],
  [r`const upcoming=mine.filter(x=>!x.done).sort((a,b)=>a.pd-b.pd||a.ph-b.ph);`,
   r`const upcoming=mine.filter(x=>!x.done).sort((a,b)=>LIVE?a.start-b.start:(a.pd-b.pd||a.ph-b.ph));`],
  [r`    const today=t?0:1;
    const days=DAYS.map((d,i)=>({label:d,date:off===0?DATES[i]:(DATES[i]+off*7>31?DATES[i]+off*7-31:DATES[i]+off*7),isToday:off===0&&i===today,notToday:!(off===0&&i===today),blocks:off===0?mine.filter(x=>x.pd===i):[],empty:off!==0||!mine.some(x=>x.pd===i)}));`,
   r`    const today=LIVE?LIVE.D.today:(t?0:1);const WK=LIVE&&LIVE.D.week?LIVE.D.week(off):null;
    const days=DAYS.map((d,i)=>({label:d,date:WK?WK.dates[i]:(off===0?DATES[i]:(DATES[i]+off*7>31?DATES[i]+off*7-31:DATES[i]+off*7)),isToday:off===0&&i===today,notToday:!(off===0&&i===today),blocks:LIVE?mine.filter(x=>x.pd===i&&(x.wk||0)===off):(off===0?mine.filter(x=>x.pd===i):[]),empty:LIVE?!mine.some(x=>x.pd===i&&(x.wk||0)===off):(off!==0||!mine.some(x=>x.pd===i))}));`],
  [r`hours.push({p:fmtH(h),s:fmtH(h+(t?15:-15)),flag:t?(h+15>=24?'+1d':''):(h-15<0?'−1d':'')});`,
   r`hours.push({p:fmtH(h),s:fmtH(h+(t?TZD:-TZD)),flag:t?(h+TZD>=24?'+1d':''):(h-TZD<0?'−1d':'')});`],
  [r`const nowTop=((t?18.3:9.3)-sH0)*SROW;`, r`const nowTop=((LIVE?LIVE.D.hourNow:(t?18.3:9.3))-sH0)*SROW;`],
  [r`const weekLabel=off===0?'Oct 4`, r`const weekLabel=WK?WK.label:off===0?'Oct 4`],
  [r`photo:x.shareLabel?((MENTORS[x.shareTo&&x.shareTo[0]]||{}).photo||IMG.mia):IMG.mia};`, r`photo:x.shareLabel?((MENTORS[x.shareTo&&x.shareTo[0]]||{}).photo||ME_PHOTO):ME_PHOTO};`],
  [r`      toggle:()=>{const was=x.done;this.setState(st=>({tasks:st.tasks.map(y=>y.id===x.id?{...y,done:!y.done}:y)}));if(!was)this.toast('Nice! '+m.first+' will see it\'s done');}};});`,
   r`      toggle:()=>{const was=x.done;this.setState(st=>({tasks:st.tasks.map(y=>y.id===x.id?{...y,done:!y.done}:y)}));if(x.taskId)this.sync('portal/task',{op:'done',id:x.taskId,done:!was},true);if(!was)this.toast(x.mine&&!x.shareLabel?'Nice work!':'Nice! '+m.first+' will see it\'s done');}};});`],
  [r`const classes=CLASSES.map(c=>{const m=MENTORS[c.m];`, r`const classes=CLASSES.map(c=>{const m=MENTORS[c.m]||{name:'',photo:''};`],
  [r`const thread=threads.find(x=>x.id===aid)||threads[0];`, r`const thread=threads.find(x=>x.id===aid)||threads[0]||{id:'',name:'',sub:'',reply:'',local:'',msgs:[]};`],
  [r`const mm=MENTORS[m.from];`, r`const mm=MENTORS[m.from]||{first:'Global Link',name:'Global Link',photo:''};`],
  [r`fromName:MENTORS[matSel.from].name`, r`fromName:(MENTORS[matSel.from]||{name:'Global Link'}).name`],
  [r`const matCls=['All','English Conversation','Pronunciation','SAT Math','US Schools'].map(`, r`const matCls=(LIVE?['All'].concat(Array.from(new Set(MATS.map(m=>m.cls)))):['All','English Conversation','Pronunciation','SAT Math','US Schools']).map(`],
  [r`hasProg:!!st.asg&&!done&&pr>0,open:()=>this.setState({matOpen:m.id})};})`, r`hasProg:!!st.asg&&!done&&pr>0,open:()=>{this.setState({matOpen:m.id});if(m.asgId&&!(MP[m.id]>0))this.sync('portal/progress',{id:m.asgId,progress:0},true);}};})`],
  [r`const cls=classes.find(c=>c.active)||classes[0];
    const rc=RECAPS[cls.id];`, r`const cls=classes.find(c=>c.active)||classes[0]||{...EMPTY_CLS,mentor:'',photo:'',pct:0};
    const rc=RECAPS[cls.id]||EMPTY_RECAP;`],
  [r`      pick:()=>this.setState(st=>({[t?'activeT':'activeS']:x.id,[t?'thT':'thS']:st[t?'thT':'thS'].map(y=>y.id===x.id?{...y,unread:0}:y)}))}));`,
   r`      pick:()=>{this.setState(st=>({[t?'activeT':'activeS']:x.id,[t?'thT':'thS']:st[t?'thT':'thS'].map(y=>y.id===x.id?{...y,unread:0}:y)}));if(LIVE&&x.unread&&!LIVE.readOnly)GLLive.api('portal/read',{from:x.id}).catch(()=>{});}}));`],
  [r`const askMentors=Object.values(MENTORS).map(`, r`const askMentors=(LIVE?((LIVE.B&&LIVE.B.directory)||[]).map(d=>MENTORS[d.id]).filter(Boolean):Object.values(MENTORS)).map(`],
  [r`const tq=s.tq.map(x=>{const st=STUDENTS[x.from];`, r`const tq=s.tq.map(x=>{const st=STUDENTS[x.from]||MENTORS[x.from]||{name:'Student',first:'Student',photo:''};`],
  [r`const stu=studs.find(x=>x.sel)||studs[0];`, r`const stu=studs.find(x=>x.sel)||studs[0]||EMPTY_STU;`],
  [r`const booked=s.sessions.some(x=>x.m==='emma'&&(()=>{const [pd,ph]=shift(x.d,x.h,-15);return pd===di&&Math.floor(ph)===h;})());`,
   r`const booked=s.sessions.some(x=>x.m===ME_ID&&(!LIVE||(!x.done&&!x.wk))&&(()=>{const [pd,ph]=LIVE?[x.d,x.h]:shift(x.d,x.h,-TZD);return pd===di&&Math.floor(ph)===h;})());`],
  [r`avRows.push({p:fmtH(h),s:fmtH(h+15),nd:h+15>=24,cells});`, r`avRows.push({p:fmtH(h),s:fmtH(h+TZD),nd:h+TZD>=24,cells});`],
  [r`const [bd,bh]=shift(d,h,15);`, r`const [bd,bh]=shift(d,h,TZD);`],
  [r`const bookSlots=BOOK_SLOTS.map(b=>{const m=MENTORS[b.m];const [sd,sh]=shift(b.d,b.h,-15);return {...b,mentor:m.name,photo:m.photo,when:dn(b.d)+', Oct '+DATES[b.d]+' · '+fmt(b.h),other:dn(sd)+' '+fmt(sh)+' in California',`,
   r`const bookSlots=BOOK_SLOTS.map(b=>{const m=MENTORS[b.m]||{name:'Mentor',photo:''};const [sd,sh]=shift(b.d,b.h,-TZD);return {...b,mentor:m.name,photo:m.photo,when:b.whenL||(dn(b.d)+', Oct '+DATES[b.d]+' · '+fmt(b.h)),other:b.otherL||(dn(sd)+' '+fmt(sh)+' in California'),`],
  [r`    const weeks=[{l:'Sep 7',v:22},{l:'Sep 14',v:38},{l:'Sep 21',v:31},{l:'Sep 28',v:46},{l:'Oct 5',v:12}].map(w=>({...w,hpx:Math.round(w.v/50*130),label:w.v+' min'}));`,
   r`    const weeksRaw=LIVE?this.liveWeeks():[{l:'Sep 7',v:22},{l:'Sep 14',v:38},{l:'Sep 21',v:31},{l:'Sep 28',v:46},{l:'Oct 5',v:12}];const WMAX=Math.max(50,...weeksRaw.map(w=>w.v));
    const weeks=weeksRaw.map(w=>({...w,hpx:Math.round(w.v/WMAX*130),label:w.v+' min'}));`],
  [r`    const mentorNotes=[{m:'emma',`, r`    const mentorNotes=(LIVE?this.liveNotes():[{m:'emma',`],
  [r`'Slow down on the last step. You knew the answer, you rushed the sign.'}].map(n=>({...n,name:MENTORS[n.m].first,photo:MENTORS[n.m].photo}));`,
   r`'Slow down on the last step. You knew the answer, you rushed the sign.'}]).map(n=>({...n,name:(MENTORS[n.m]||{first:''}).first,photo:(MENTORS[n.m]||{}).photo||''}));`],
  [r`const platform=p.platform||'web';`, r`const platform=(window.glApp&&window.glApp.platformProp)||p.platform||'web';`],
  [r`signInWeChat:()=>{this.toast('Opening WeChat to confirm…','message-circle');this.later(()=>this.startSync('student'),700);},signInGoogle:()=>{this.toast('Opening Google sign-in…','log-in');this.later(()=>this.startSync('student'),700);},`,
   r`signInWeChat:()=>this.toast('WeChat sign-in is coming soon. Use your globallink.com username and password for now.','message-circle'),signInGoogle:()=>this.toast('Google sign-in is coming to the app soon. Use your globallink.com username and password for now.','log-in'),`],
  [r`syncTitle:t?'Welcome, Emma':'Welcome, Mia',syncItems,`, r`syncTitle:LIVE&&LIVE.me?'Welcome, '+GLLive.first(LIVE.me.name):s.resuming?'Welcome back':(t?'Welcome, Emma':'Welcome, Mia'),syncItems,`],
  [r`signOut:()=>this.setState({stage:'signin',meOpen:false,call:null}),`, r`signOut:()=>this.signOut(),`],
  [r`resched:()=>{this.setState({sessFor:null});`, r`resched:()=>{if(LIVE&&sf&&!sf.requested){this.sync('portal/message',{to:t?sf.who:sf.m,text:'Hi! Could we reschedule our lesson on '+sf.when+'? Which times work for you?'},true);}this.setState({sessFor:null});`],
  [r`addCal:()=>this.toast('Added to your calendar','calendar-plus'),`, r`addCal:()=>{if(LIVE)this.icsFor(sf);else this.toast('Added to your calendar','calendar-plus');},`],
  [r`confirmBook:()=>{const b=BOOK_SLOTS.find(x=>x.id===s.bookSlot);if(!b)return;`,
   r`confirmBook:()=>{const b=BOOK_SLOTS.find(x=>x.id===s.bookSlot);if(!b)return;if(LIVE){this.sync('portal/book',{tutorId:b.tutorId,start:b.start}).then(ok=>{if(ok){this.setState({bookOpen:false,bookSlot:null});this.toast('Booked! '+(MENTORS[b.m]||{first:'Your mentor'}).first+' will see it right away.','calendar-check');}});return;}`],
  [r`submitTaskRec:()=>{`, r`submitTaskRec:()=>{if(LIVE){this.setState({taskRec:null});this.toast('Voice notes are coming soon. Send a message instead.','mic');return;}`],
  [r`sendAsk:()=>{if(s.askText.trim().length<4)return;`,
   r`sendAsk:()=>{if(s.askText.trim().length<4)return;if(LIVE){const am=MENTORS[s.askTo];if(!am){this.toast('Pick a mentor first','info');return;}this.sync('portal/ask',{to:s.askTo,q:s.askText.trim(),kind:s.askType,share:s.askShare}).then(ok=>{if(ok){this.setState({askOpen:false,askText:''});this.toast('Sent to '+am.first+'. You\'ll get a notification when they reply.','send');}});return;}`],
  [r`sendReply:()=>{if(!rq)return;const nm=rq.first;`,
   r`sendReply:()=>{if(!rq)return;const nm=rq.first;if(LIVE){const tx=(s.replyText||'').trim();if(tx.length<2){this.toast(rq.isVideo?'Video replies are coming soon. Write a text reply for now.':'Write your reply first','info');return;}this.sync('portal/answer',{id:rq.qid,text:tx}).then(ok=>{if(ok){this.setState({recOn:false,recDone:false,recSecs:0,replyText:''});this.toast('Reply sent to '+nm,'send');}});return;}`],
  [r`savePrep:()=>this.toast('Prep notes saved','check'),`, r`savePrep:()=>{if(LIVE)this.setState(x=>({prepNotes:{...(x.prepNotes||{}),[stu.id]:s.prepText||stu.prep}}));this.toast('Prep notes saved','check');},`],
  [r`emailShown:t?'emma.carter@example.com':'mia.lin@example.com',`, r`emailShown:LIVE&&LIVE.me?LIVE.me.email:(t?'emma.carter@example.com':'mia.lin@example.com'),`],
  [r`this.toast(t?'Mia is joining…':'You joined. Emma can see you.','video');`, r`this.toast(LIVE?'You’re in the lesson room. Video lessons are a preview for now.':(t?'Mia is joining…':'You joined. Emma can see you.'),'video');`, 2],
  [r`finishCall:()=>{this.setState({call:null,feel:null});this.go(t?'today':'home');this.toast(t?'Notes sent to Mia':'Recap will be ready in a few minutes','check');},`,
   r`finishCall:()=>{this.setState({call:null,feel:null});this.go(t?'today':'home');this.toast(LIVE?'Lesson closed':(t?'Notes sent to Mia':'Recap will be ready in a few minutes'),'check');},`],
  [r`sendFeedback:()=>{this.setState({fbSent:true});`,
   r`sendFeedback:()=>{if(LIVE){const L0=this._callFor;if(!L0||!L0.lessonId){this.toast('Pick a lesson first','info');return;}const nm=(STUDENTS[L0.who]||MENTORS[L0.who]||{first:'your student'}).first;this.sync('portal/lesson',{op:'feedback',id:L0.lessonId,text:s.fbText,next:s.fbNext,color:s.fbColor}).then(ok=>{if(ok){this.setState({fbSent:true});this.later(()=>{this.setState({call:null});this.go('today');this.toast('Notes sent to '+nm+'. They’ll see them on their home screen.','send');},900);}});return;}this.setState({fbSent:true});`],
  [r`msgEmma:()=>{this.setState({activeS:'emma'});this.go('messages');},viewMia:()=>{this.setState({selStudent:'mia'});this.go('students');},`,
   r`msgEmma:()=>{this.setState({activeS:LIVE?((next&&next.m)||'team'):'emma'});this.go('messages');},viewMia:()=>{this.setState({selStudent:LIVE?((next&&next.who)||''):'mia'});this.go('students');},`],

  // ---- moreVals ----
  [r`const plat=p.platform||'web';`, r`const plat=(window.glApp&&window.glApp.platformProp)||p.platform||'web';`],
  [r`V.username=t?'emma.carter':'mia.lin';`, r`V.username=LIVE&&LIVE.me?(LIVE.me.username||''):(t?'emma.carter':'mia.lin');`],
  [r`['repeat','Prototype: '+(t?'student':'mentor')+' view','',()=>this.switchRole(),'var(--gl-ink)'],['external-link','Open globallink.com','',()=>this.toast('Opening globallink.com','external-link'),'var(--gl-ink)'],['log-out','Sign out','',()=>this.setState({stage:'signin',meTop:false,call:null}),'var(--gl-danger)']]`,
   r`...(LIVE?[]:[['repeat','Prototype: '+(t?'student':'mentor')+' view','',()=>this.switchRole(),'var(--gl-ink)']]),['external-link','Open globallink.com','',()=>{this.setState({meTop:false});this.openSite('');},'var(--gl-ink)'],['log-out','Sign out','',()=>this.signOut(),'var(--gl-danger)']]`],
  [r`hello:()=>{this.setState(t?{activeT:'mia'}:{activeS:'emma'});this.go('messages');}`, r`hello:()=>{this.setState(LIVE?{[t?'activeT':'activeS']:((TH_S.find(x=>x.id!=='team')||{}).id||'team')}:(t?{activeT:'mia'}:{activeS:'emma'}));this.go('messages');}`],
  [r`profile:()=>{this.markSetup('profile');this.toast('Opening your mentor profile on globallink.com','external-link');}`, r`profile:()=>{this.markSetup('profile');if(LIVE){this.go('settings');this.setState({settingsTab:'account'});}else this.toast('Opening your mentor profile on globallink.com','external-link');}`],
  [r`'Nice work! Want me to show you where everything lives?']][s.wStep][0];`, r`'Nice work! Want me to show you where everything lives?']][s.wStep][0];if(LIVE&&s.wStep===3)V.wLumi=this.liveWelcomeLumi();`],
  [r`V.wGoal=t?'Help students feel brave enough to just start talking.':STUDENTS.mia.goal;`, r`V.wGoal=t?(LIVE?(s.why||'Tell students why you mentor in Settings.'):'Help students feel brave enough to just start talking.'):this.myStu().goal;`],
  [r`(t?['Conversation','Pronunciation','IELTS']:STUDENTS.mia.interests)`, r`(t?(LIVE?String(s.teaches||'Add what you teach in Settings').split(/\s*,\s*/).filter(Boolean):['Conversation','Pronunciation','IELTS']):this.myStu().interests)`],
  [r`accept:()=>{this.setState(x=>({tReqs:x.tReqs.map(y=>y.id===r.id?{...y,status:3}:y)}));`, r`accept:()=>{if(r.matchId)this.sync('portal/respond',{id:r.matchId,accept:true});this.setState(x=>({tReqs:x.tReqs.map(y=>y.id===r.id?{...y,status:3}:y)}));`],
  [r`decline:()=>{this.setState(x=>({tReqs:x.tReqs.map(y=>y.id===r.id?{...y,status:0}:y)}));this.markSetup('mentors');this.toast('Declined kindly. We’ll find Ava another mentor.','check');}};});`,
   r`decline:()=>{if(r.matchId)this.sync('portal/respond',{id:r.matchId,accept:false});this.setState(x=>({tReqs:x.tReqs.map(y=>y.id===r.id?{...y,status:0}:y)}));this.markSetup('mentors');this.toast('Declined kindly. We’ll find '+r.name.split(' ')[0]+' another mentor.','check');}};});`],
  [r`'Emma, Sarah and David will see these when they open new times.'`, r`(LIVE?'Your mentors see these when they open new times.':'Emma, Sarah and David will see these when they open new times.')`],
  [r`V.noteGoal=nt(t?V.wGoal:STUDENTS.mia.goal,`, r`V.noteGoal=nt(t?V.wGoal:this.myStu().goal,`],
  [r`V.noteMiaGoal=nt(STUDENTS.mia.goal,`, r`V.noteMiaGoal=nt(this.myStu().goal,`],
  [r`V.myMentors=['emma','sarah','david'].map(`, r`V.myMentors=MY_MENTOR_IDS.filter(id=>MENTORS[id]&&MDETAIL[id]).map(`],
  [r`cancel:()=>{this.setState(x=>({reqs:x.reqs.filter(y=>y.id!==r.id)}));`, r`cancel:()=>{if(r.reqId)this.sync('portal/cancel-request',{id:r.reqId});this.setState(x=>({reqs:x.reqs.filter(y=>y.id!==r.id)}));`],
  [r`const cl=CLASSES.find(c=>c.id===s.selClass)||CLASSES[0];const rcx=RECAPS[cl.id];const M=MENTORS[cl.m];`, r`const cl=CLASSES.find(c=>c.id===s.selClass)||CLASSES[0]||EMPTY_CLS;const rcx=RECAPS[cl.id]||EMPTY_RECAP;const M=MENTORS[cl.m]||{first:'',name:'',photo:'',note:'pink'};`],
  [r`V.ntMentors=['emma','sarah','david'].map(`, r`V.ntMentors=MY_MENTOR_IDS.filter(id=>MENTORS[id]).map(`],
  [r`      this.setState(upd);this.toast(!s.ntShare?`, r`      this.setState(upd);if(LIVE){this.sync('portal/task',{op:'create',title:task.title,kind:task.kind,cls:task.cls,due:task.due,shareWith:task.shareTo},true);if(s.ntShare&&s.ntMsgOn)to.forEach(id=>this.sync('portal/message',{to:id,text:(s.ntMsg.trim()?s.ntMsg.trim()+'\n\n':'')+'Task attached: '+task.title+' · due '+s.ntDue.toLowerCase()},true));}this.toast(!s.ntShare?`],
  [r`const to=Object.keys(s.ntTo).filter(k=>s.ntTo[k]);const names=to.map(k=>MENTORS[k].first);`, r`const to=Object.keys(s.ntTo).filter(k=>s.ntTo[k]&&MENTORS[k]);const names=to.map(k=>MENTORS[k].first);`],
  [r`m.by==='Emma Carter'`, r`m.by===ME_NAME`, 3],
  [r`reach:(n===4?'All your students can get this':n+' of 4 students can get this')`, r`reach:(n===Object.keys(PLANS).length?'All your students can get this':n+' of '+Object.keys(PLANS).length+' students can get this')`],
  [r`const left=pl.of-pl.used;return {name:st.name,photo:st.photo,plan:pl.plan,left:left?left+' left':'Used up',leftFg:left?'var(--gl-ink)':'var(--gl-danger)',pct:Math.round(pl.used/pl.of*100),`,
   r`const left=pl.of-pl.used;return {name:st.name,photo:st.photo,plan:pl.plan,left:LIVE?'':(left?left+' left':'Used up'),leftFg:LIVE||left?'var(--gl-ink)':'var(--gl-danger)',pct:pl.of?Math.round(pl.used/pl.of*100):0,`],
  [r`V.asgSend=()=>{if(!to.length)return;`, r`V.asgSend=()=>{if(!to.length)return;if(LIVE){this.sync('portal/assign',{mats:selMats.map(m=>m.id),to,due:s.asgDue,note:s.asgNote.trim(),task:s.asgTask}).then(ok=>{if(ok){this.setState({asgOpen:false,libSel:{},libTab:'asg'});this.toast('Assigned to '+to.map(k=>STUDENTS[k].first).join(', '),'send');}});return;}`],
  [r`const m=LIBX.find(x=>x.id===a.mat)||LIBX[0];`, r`const m=LIBX.find(x=>x.id===a.mat)||LIBX[0]||{title:'Material',icon:'file-text'};`],
  [r`people:a.to.map(id=>{const st=STUDENTS[id];`, r`people:a.to.map(id=>{const st=STUDENTS[id]||MENTORS[id]||{name:'Student',first:'Student',photo:''};`],
  [r`remind:()=>this.toast('Reminder sent to '+a.to.map(id=>STUDENTS[id].first).join(', '),'bell'),remove:()=>{this.setState(x=>({tAssigned:x.tAssigned.filter(y=>y.id!==a.id)}));`,
   r`remind:()=>{if(LIVE)a.to.forEach(id=>this.sync('portal/message',{to:id,text:'Reminder: please open “'+m.title+'”'+(a.due&&a.due!=='No due date'?' (due '+a.due+')':'')+'. It’s in your Materials.'},true));this.toast('Reminder sent to '+a.to.map(id=>(STUDENTS[id]||{first:'your student'}).first).join(', '),'bell');},remove:()=>{if(a.asgId)this.sync('portal/unassign',{id:a.asgId},true);this.setState(x=>({tAssigned:x.tAssigned.filter(y=>y.id!==a.id)}));`],
  [r`const DD={'Dec 5, 2026':59,'Mar 13, 2027':157,'May 8, 2027':213};const days=DD[SAT.date];`, r`const DD={'Dec 5, 2026':59,'Mar 13, 2027':157,'May 8, 2027':213};const days=LIVE?this.daysTo(SAT.date):DD[SAT.date];`],
  [r`d:'Oct 7'`, r`d:this.todayShort()`, 2],
  [r`this.toast('SAT tracker is set. David can see your goal now.','target');`, r`this.toast(LIVE?'SAT tracker is set. Your mentors can see your goal now.':'SAT tracker is set. David can see your goal now.','target');`],
  [r`this.toast(ld>0?'Saved. That’s +'+ld+'! David will see it.':'Saved. David will look at what went wrong with you.',`, r`this.toast(ld>0?'Saved. That’s +'+ld+'! '+(LIVE?'Your mentors':'David')+' will see it.':'Saved. '+(LIVE?'Your mentor':'David')+' will look at what went wrong with you.',`],
  [r`ask:()=>{this.setState({skill:null,activeS:'david',`, r`ask:()=>{this.setState({skill:null,activeS:LIVE?(MY_MENTOR_IDS[0]||'team'):'david',`],
  [r`by:owner==='admin'?'Global Link':'Emma Carter'});};`, r`by:owner==='admin'?'Global Link':ME_NAME});};`],
  [r`const submitMy=m=>{this.setState(`, r`const submitMy=m=>{if(LIVE)this.sync('portal/material',{id:m.id,title:m.title,type:m.type,pack:m.pack,level:m.level,blocks:m.blocks,status:'In review'},true);this.setState(`],
  [r`const approve=m=>{this.setState(`, r`const approve=m=>{if(LIVE)this.sync('admin/material',{op:'review',id:m.id,approve:true,title:m.title,type:m.type,pack:m.pack,level:m.level,blocks:m.blocks},true);this.setState(`],
  [r`const changes=m=>{this.setState(`, r`const changes=m=>{if(LIVE)this.sync('admin/material',{op:'review',id:m.id,approve:false},true);this.setState(`],
  [r`dup:()=>{const id='al'+Date.now();`, r`dup:()=>{if(LIVE)this.sync('admin/material',{title:m.title+' (copy)',type:m.type,pack:m.pack,level:m.level,blocks:m.blocks,status:'Draft'},true);const id='al'+Date.now();`],
  [r`arch:()=>{updA(m.id,{status:st==='Archived'?'Published':'Archived'});`, r`arch:()=>{if(LIVE)this.sync('admin/material',{op:'status',id:m.id,status:st==='Archived'?'Published':'Archived'},true);updA(m.id,{status:st==='Archived'?'Published':'Archived'});`],
  [r`arch:()=>{this.setState(x=>({myMats:x.myMats.map(y=>y.id===m.id?{...y,status:'Private'}:y)}));`, r`arch:()=>{if(LIVE)this.sync('admin/material',{op:'status',id:m.id,status:'Private'},true);this.setState(x=>({myMats:x.myMats.map(y=>y.id===m.id?{...y,status:'Private'}:y)}));`],
  [r`bld:{...x.bld,id,status:item.status}};});return item;};`, r`bld:{...x.bld,id,status:item.status}};});if(LIVE)item._p=this.saveMatLive(B,item,status);return item;};`],
  [r`V.bldSend=()=>{const it=save();this.later(()=>sendMy(it.id),30);};`, r`V.bldSend=()=>{const it=save();if(it._p)it._p.then(id=>{if(id)this.later(()=>sendMy(id),400);});else this.later(()=>sendMy(it.id),30);};`],
  [r`{const pl=PLANS[s.selStudent]||PLANS.mia;const left=pl.of-pl.used;V.stuPlan={plan:pl.plan,left:left?left+' of '+pl.of+' lessons left':'All lessons used',packs:pl.packs.map(k=>PACKS[k][0]).join(', '),pct:Math.round(pl.used/pl.of*100)};}`,
   r`{const pl=PLANS[s.selStudent]||PLANS.mia||{plan:'',used:0,of:0,packs:[]};const left=pl.of-pl.used;V.stuPlan={plan:pl.plan,left:LIVE?'Lesson credits are managed by Global Link':(left?left+' of '+pl.of+' lessons left':'All lessons used'),packs:pl.packs.map(k=>PACKS[k][0]).join(', '),pct:pl.of?Math.round(pl.used/pl.of*100):0};}`],
  [r`{value:'current',label:'Current · 3'}`, r`{value:'current',label:'Current · '+(LIVE?MY_MENTOR_IDS.length:3)}`],
  [r`const reqPast=p=>{if(s.pastReq[p.id])return;`, r`const reqPast=p=>{if(s.pastReq[p.id])return;if(LIVE){this.sync('portal/request',{subject:p.subj,mentorName:p.name,note:'I’d like to work with '+p.name+' again.'}).then(ok=>{if(ok){this.setState(x=>({pastReq:{...x.pastReq,[p.id]:true}}));this.toast('Request sent to '+p.first+'. We’ll let you know when they reply.','send');}});return;}`],
  [r`const pp=PAST.find(p=>p.id===s.pastOpen)||PAST[0];`, r`const pp=PAST.find(p=>p.id===s.pastOpen)||PAST[0]||EMPTY_PAST;`],
  [r`V.sendReq=()=>{const id='r'+Date.now();`, r`V.sendReq=()=>{if(LIVE){this.sync('portal/request',{subject:s.reqSubj,note:s.reqNote.trim(),times:s.timePrefs}).then(ok=>{if(ok){this.setState({reqOpen:false,reqNote:''});if(s.page!=='mentors')this.go('mentors');this.toast('Request sent. We’re on it.','send');}});return;}const id='r'+Date.now();`],
  [r`like:()=>this.setState(x=>({liked:{...x.liked,[po.id]:!x.liked[po.id]}})),`, r`like:()=>{this.setState(x=>({liked:{...x.liked,[po.id]:!x.liked[po.id]}}));if(LIVE)this.sync('portal/like',{postId:po.id,on:!liked},true);},`],
  [r`const tx=this.state.cmDraft.trim();if(!tx)return;`, r`const tx=this.state.cmDraft.trim();if(!tx)return;if(LIVE)this.sync('portal/comment',{postId:po.id,text:tx},true);`, 2],
  [r`V.ev0=evv(EVENTS[0]);`, r`V.ev0=EVENTS[0]?evv(EVENTS[0]):{};V.hasEvents=EVENTS.length>0;V.noEvents=!EVENTS.length;`],
  [r`V.submitPost=()=>{if(s.pTitle.trim().length<4)return;const g=GROUPS.find(x=>x.id===s.pGroup);`,
   r`V.submitPost=()=>{if(s.pTitle.trim().length<4)return;const g=GROUPS.find(x=>x.id===s.pGroup);if(LIVE){this.sync('portal/post',{title:s.pTitle.trim(),body:s.pBody.trim(),type:s.pType,group:s.pGroup}).then(r=>{if(r){this.setState({postOpen:false,pTitle:'',pBody:'',comTab:'posts',comFilter:'All',comSort:'latest'});this.toast(r.pending?'Thanks! Your first post shows after a quick review.':'Posted to '+g.name,'send');}});return;}`],
  [r`V.testAV=()=>this.toast('Camera, microphone and speakers look good','circle-check');V.checkUpdates=()=>this.toast('You’re up to date (0.1.0)','circle-check');`, r`V.testAV=()=>this.testAV();V.checkUpdates=()=>this.checkUpdates();`],
  [r`V.asAdminLogin=()=>{this.setState({email:'Admin718',pw:'[redacted]'});this.startSync('admin');};`, r`V.asAdminLogin=()=>this.setState({email:'',pw:''});`],
  [r`V.backToAdmin=()=>{this.setState({asAdmin:false,call:null,meOpen:false,meTop:false});this.enterApp('admin');this.later(()=>this.setState({page:'a_people'}),20);};`, r`V.backToAdmin=()=>this.backToAdmin();`],
  [r`const su=[3,5,2,6,4,8,7];const mx=Math.max(...su);V.aSignups=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(`,
   r`const SUL=LIVE&&LIVE.kind==='admin'?LIVE.D.signups:null;const su=SUL?SUL.map(x=>x.v):[3,5,2,6,4,8,7];const mx=Math.max(1,...su);V.aSignups=(SUL?SUL.map(x=>x.l):['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map(`],
  [r`V.aViewAs=()=>{const r=au.id==='mia'`, r`V.aViewAs=()=>{if(LIVE){this.viewAs(au);return;}const r=au.id==='mia'`],
  [r`V.aMsg=()=>this.toast('Message to '+au.name+' opens in the full app','message-circle');`, r`V.aMsg=()=>{if(LIVE){this.setState({aMsgOpen:true,aMsgText:'',aThread:[]});this.loadThread(au.id);return;}this.toast('Message to '+au.name+' opens in the full app','message-circle');};`],
  [r`V.aReset=()=>{this.audit(`, r`V.aReset=()=>{if(LIVE){this.sync('admin/reset',{id:au.id}).then(r=>{if(r&&r.link){try{navigator.clipboard.writeText(r.link);}catch(e){}this.toast('Reset link copied. Send it to '+au.name+'. It works for 1 hour.','key-round');}});return;}this.audit(`],
  [r`V.aSuspend=()=>{updU({status:sus?'Active':'Suspended'});`, r`V.aSuspend=()=>{if(LIVE)this.sync('admin/user',{id:au.id,op:'status',value:sus?'Active':'Suspended'},true);updU({status:sus?'Active':'Suspended'});`],
  [r`V.aCredPlus=()=>{updU({credits:(au.credits||0)+1});`, r`V.aCredPlus=()=>{if(LIVE)this.sync('admin/user',{id:au.id,op:'credits',value:1},true);updU({credits:(au.credits||0)+1});`],
  [r`V.aCredMinus=()=>{if(!au.credits)return;updU({credits:au.credits-1});`, r`V.aCredMinus=()=>{if(!au.credits)return;if(LIVE)this.sync('admin/user',{id:au.id,op:'credits',value:-1},true);updU({credits:au.credits-1});`],
  [r`V.aSetRole=v=>{if(v===au.role)return;`, r`V.aSetRole=v=>{if(v===au.role)return;if(LIVE){if(v==='Admin'){this.toast('Admins are set up on the server, not by role.','info');return;}this.sync('admin/user',{id:au.id,op:'role',value:v},true);}`],
  [r`V.setANote=v=>this.setState(x=>({aNotes:{...x.aNotes,[au.id]:v}}));`, r`V.setANote=v=>{this.setState(x=>({aNotes:{...x.aNotes,[au.id]:v}}));if(LIVE){clearTimeout(this._noteT);this._noteT=setTimeout(()=>GLLive.api('admin/user',{id:au.id,op:'note',value:v}).catch(()=>{}),700);}};`],
  [r`sugg:q.sugg.map(([id,fit,why])=>{const m=MENTORS[id];`, r`sugg:q.sugg.map(([id,fit,why])=>{const m=MENTORS[id]||{name:'Mentor',first:'Mentor',photo:''};`],
  [r`assign:()=>{this.setState(x=>({mq:x.mq.filter(y=>y.id!==q.id)}));`, r`assign:()=>{if(LIVE)this.sync('admin/match',{requestId:q.reqId,tutorId:id},true);this.setState(x=>({mq:x.mq.filter(y=>y.id!==q.id)}));`],
  [r`decline:()=>{this.setState(x=>({mq:x.mq.filter(y=>y.id!==q.id)}));`, r`decline:()=>{if(LIVE)this.sync('admin/decline-request',{requestId:q.reqId},true);this.setState(x=>({mq:x.mq.filter(y=>y.id!==q.id)}));`],
  [r`      cancel:()=>{this.setState(x=>({aLes:x.aLes.map((y,j)=>j===i?[...y.slice(0,5),'Cancelled']:y)}));`, r`      cancel:()=>{if(LIVE)this.sync('admin/lesson',{id:l[6],op:'cancel'},true);this.setState(x=>({aLes:x.aLes.map((y,j)=>j===i?[...y.slice(0,5),'Cancelled',...y.slice(6)]:y)}));`],
  [r`      credit:()=>{this.setState(x=>({aLes:x.aLes.map((y,j)=>j===i?[...y.slice(0,5),'Cancelled']:y)}));`, r`      credit:()=>{if(LIVE)this.sync('admin/lesson',{id:l[6],op:'credit'},true);this.setState(x=>({aLes:x.aLes.map((y,j)=>j===i?[...y.slice(0,5),'Cancelled',...y.slice(6)]:y)}));`],
  [r`toggle:()=>{this.setState(st=>({pkgs:st.pkgs.map(y=>y.id===pk.id?{...y,on:!y.on}:y)}));`, r`toggle:()=>{this.setState(st=>({pkgs:st.pkgs.map(y=>y.id===pk.id?{...y,on:!y.on}:y)}));if(LIVE)this.sync('admin/config',{key:'pkgs',value:s.pkgs.map(y=>({id:y.id,name:y.name,price:y.price,on:y.id===pk.id?!y.on:y.on}))},true);`],
  [r`setPrice:e=>{const v=e.target.value.replace(/[^0-9]/g,'');this.setState(st=>({pkgs:st.pkgs.map(y=>y.id===pk.id?{...y,price:v}:y)}));}}));`, r`setPrice:e=>{const v=e.target.value.replace(/[^0-9]/g,'');this.setState(st=>({pkgs:st.pkgs.map(y=>y.id===pk.id?{...y,price:v}:y)}));if(LIVE){clearTimeout(this._pkT);this._pkT=setTimeout(()=>GLLive.api('admin/config',{key:'pkgs',value:this.state.pkgs.map(y=>({id:y.id,name:y.name,price:y.price,on:y.on}))}).catch(()=>{}),800);}}}));`],
  [r`const done=(verb,ic,msg)=>()=>{this.setState(x=>({modQ:x.modQ.filter(y=>y.id!==m.id)}));`, r`const done=(verb,ic,msg)=>()=>{if(LIVE)this.sync('admin/moderate',{id:m.id,op:verb==='Kept'?'keep':verb==='Removed'?'remove':'warn'},true);this.setState(x=>({modQ:x.modQ.filter(y=>y.id!==m.id)}));`],
  [r`toggle:()=>{this.setState(x=>({modRules:{...x.modRules,[k]:!on}}));`, r`toggle:()=>{this.setState(x=>({modRules:{...x.modRules,[k]:!on}}));if(LIVE)this.sync('admin/config',{key:'modRules',value:{...s.modRules,[k]:!on},audit:(on?'Turned off ':'Turned on ')+'“'+l+'”',icon:'shield'},true);`],
  [r`V.annSend=()=>{if(V.annCant)return;const a={t:s.annDraft.trim(),aud:s.annAud,tone:s.annTone};`, r`V.annSend=()=>{if(V.annCant)return;const a={t:s.annDraft.trim(),aud:s.annAud,tone:s.annTone};if(LIVE){const h=[{t:a.t,aud:audL[a.aud],when:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'}),state:'Live'}].concat((s.annHist||[]).map(x=>x.state==='Live'?{...x,state:'Ended'}:x)).slice(0,30);this.sync('admin/config',{key:'announce',value:a,audit:'Published an announcement to '+audL[a.aud].toLowerCase(),icon:'megaphone'},true);this.sync('admin/config',{key:'annHist',value:h},true);}`],
  [r`V.annStop=()=>{this.setState(`, r`V.annStop=()=>{if(LIVE){this.sync('admin/config',{key:'announce',value:null,audit:'Took down the current announcement',icon:'megaphone'},true);this.sync('admin/config',{key:'annHist',value:(s.annHist||[]).map(h=>h.state==='Live'?{...h,state:'Ended'}:h)},true);}this.setState(`],
  [r`toggle:()=>{this.setState(x=>({flags:{...x.flags,[k]:!on}}));`, r`toggle:()=>{this.setState(x=>({flags:{...x.flags,[k]:!on}}));if(LIVE)this.sync('admin/config',{key:'flags',value:{...s.flags,[k]:!on},audit:(on?'Turned off ':'Turned on ')+l+' for everyone',icon:'sliders-horizontal'},true);`],
  [r`V.toggleMaint=()=>{this.setState(x=>({maint:!x.maint}));`, r`V.toggleMaint=()=>{this.setState(x=>({maint:!x.maint}));if(LIVE)this.sync('admin/config',{key:'maint',value:!s.maint,audit:(s.maint?'Removed':'Posted')+' the maintenance banner',icon:'wrench'},true);`],
  [r`const devGo=(role,fresh)=>()=>{this.setState({asAdmin:false,stage:'signin',call:null,meOpen:false,meTop:false});this.later(()=>{this.setState({email:role==='tutor'?'emma.carter@example.com':'mia.lin@example.com'});this.startSync(role,fresh);},30);};`,
   r`const devGo=(role,fresh)=>()=>this.enterDemo(role,fresh);`],
  [r`    return V;
  }
}`, r`    V.LIVE=false;V.DEMO=true;V.siteUrl=SITE_URL;V.appVersion=APP_VERSION;V.readOnly=false;
    V.needOtp=!!s.needOtp;V.otp=s.otp||'';V.setOtp=v=>this.setState({otp:v,signErr:''});V.setKeep=e=>this.setState({keep:!!(e&&e.target&&e.target.checked)});
    V.T={matsEmpty:'Nothing matches that yet.',feedEmpty:'Nothing here yet. Be the first to post.',satSetup:'Tell us your test date, your latest score and your goal. David builds your practice around it, and every practice test you log updates this page.',satDiag:'No problem. David will send a 30-minute diagnostic test. Your score shows up here when you finish.',satAsk:'Ask David to cover it next lesson',quizWait:'Mia is answering',quizDone:'Mia got it right',wordPop:'Pops up on Mia’s screen with sound and 中文.',slides:'Golden Week story map',endTitle:'Nice work, Mia!',endSub:'You talked for 18 of 40 minutes. That’s your best yet.',feelNote:'Emma sees this. It helps her plan next week.',leaveTitle:'Leave Mia a note',leaveSub:'It lands on her home screen as a sticky note. Short and kind works best.'};
    V.weekEmptyMsg=V.notThisWeek;V.qs=V.qs.map(q=>({...q,showPlay:q.answered,hasAns:false}));V.qsEmpty=false;V.sharedEmpty=false;V.weeksEmpty=false;V.wordsEmpty=false;V.notesEmpty=false;V.mentorsEmpty=false;V.pastEmpty=false;V.studsEmptyPage=false;V.showStuds=true;V.isTutorRole=t;V.noClasses=false;V.hasClasses=false;V.lv={};
    V.signupHref=SITE_URL+'/#/start';V.forgotHref=SITE_URL+'/#/login';V.isDesktop=!!window.glDesktop;
    if(LIVE)this.liveVals(V);
    return V;
  }
}`],

  // Saving: real accounts save preferences and progress to the server.
  [r`  savePrefs(){try{const s=this.state;`, r`  savePrefs(){try{const T0=this.state.toggles||{};if(window.glDesktop)window.glDesktop.configure({openAtLogin:!!T0.startup,tray:!!T0.tray});}catch(e){}if(LIVE){if(LIVE.kind!=='member'||LIVE.readOnly)return;clearTimeout(this._saveT);this._saveT=setTimeout(()=>{const s=this.state,o={};STATE_KEYS.forEach(k=>{if(s[k]!==undefined)o[k]=s[k];});GLLive.api('portal/state',{state:o}).catch(()=>{});},700);return;}try{const s=this.state;`],
  [r`ps.hourMode!==s.hourMode||ps.capLang!==s.capLang))this.savePrefs();`, r`ps.hourMode!==s.hourMode||ps.capLang!==s.capLang||(LIVE&&STATE_KEYS.some(k=>ps[k]!==s[k]))))this.savePrefs();`],
  [r`  enterApp(role){let sv={};if(this.fresh){`, r`  enterApp(role){let sv={};if(LIVE&&LIVE.kind==='member'){const s0=LIVE.B.state||{};sv={onboarded:s0.onboarded,setup:s0.setup,timePrefs:s0.timePrefs};}else if(this.fresh){`],
  [r`page:role==='admin'?'a_overview':role==='tutor'?'today':'home',count:702,`, r`page:role==='admin'?'a_overview':role==='tutor'?'today':'home',count:LIVE&&LIVE.D&&LIVE.D.nextStart?Math.max(0,Math.round((LIVE.D.nextStart-Date.now())/1000)):702,`],
];
