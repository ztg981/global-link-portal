// Code inserted into the design's script by build-app.mjs.
// MODE_CODE goes at module level (after initAvail); METHODS into the component class.

export const MODE_CODE = String.raw`
// ---- Data mode ------------------------------------------------------------
// DEMO: the design's sample accounts (Mia, Emma, admin data), reachable from Admin -> Developer.
// LIVE: a real account. Data comes from the API and is mapped to the same shapes by live.js.
let LIVE=null,TZD=15,ME_ID='emma',ME_NAME='Emma Carter',ME_PHOTO=IMG.mia,MY_MENTOR_IDS=['emma','sarah','david'],SH_LIVE=null;
const DEMO_SNAP={MENTORS,STUDENTS,REQS,TREQS,MDETAIL,PLANS,LIB,MYMATS0,PAST,GROUPS,EVENTS,POSTS,DATES,SESS,BOOK_SLOTS,TASKS,MSTAT,MATS,CLASSES,RECAPS,TH_S,TH_T,QS,SHARED,TQ,NOTIF_S,NOTIF_T,USERS,AUDIT0,MQ0,MOD0,LESSONS_A,TXN0,PKG0};
const EMPTY_RECAP={date:'',title:'',len:'00:00',summary:[],words:[],lines:[]};
const EMPTY_STU={id:'',name:'',first:'',zh:'',photo:'',grade:'',city:'',level:'',goal:'',interests:[],last:'',next:'',lessons:0,prep:''};
const EMPTY_PAST={id:'',name:'',first:'',role:'',subj:'',span:'',ended:'',quote:'',color:'gold',note:'',noteDate:'',words:0,avail:'',lessons:[]};
const EMPTY_CLS={id:'',name:'',zh:'',m:'',when:'',done:0,of:1,icon:'book-open'};
const SITE_URL=(window.GL_CONFIG&&window.GL_CONFIG.site)||'https://global-link-club.vercel.app';
const APP_VERSION=(window.GL_CONFIG&&window.GL_CONFIG.version)||'0.1.0';
const STATE_KEYS=['themeMode','lang','zoom','toggles','hourMode','capLang','onboarded','setup','timePrefs','sGrid','avail','savedWords','sat','satAns','joined','savedP','pinned','notifPrefs','startup','goal','interests','grade','city','teaches','why','prepNotes','rsvp'];
function setDemo(){({MENTORS,STUDENTS,REQS,TREQS,MDETAIL,PLANS,LIB,MYMATS0,PAST,GROUPS,EVENTS,POSTS,DATES,SESS,BOOK_SLOTS,TASKS,MSTAT,MATS,CLASSES,RECAPS,TH_S,TH_T,QS,SHARED,TQ,NOTIF_S,NOTIF_T,USERS,AUDIT0,MQ0,MOD0,LESSONS_A,TXN0,PKG0}=DEMO_SNAP);LIVE=null;TZD=15;ME_ID='emma';ME_NAME='Emma Carter';ME_PHOTO=IMG.mia;MY_MENTOR_IDS=['emma','sarah','david'];SH_LIVE=null;}
function setLive(L){LIVE=L;const D=L.D;TZD=D.TZD||15;
  if(L.kind==='admin'){MENTORS=D.MENTORS;USERS=D.USERS;MQ0=D.MQ;MOD0=D.MOD;LESSONS_A=D.LESSONS;AUDIT0=D.AUDIT;TXN0=[];PKG0=D.PKG;MYMATS0=D.MYMATS;STUDENTS={};PLANS={};LIB=[];CLASSES=[];MATS=[];MSTAT={};BOOK_SLOTS=[];PAST=[];EVENTS=[];SHARED=[];TASKS=[];SESS=[];TH_S=[];TH_T=[];QS=[];TQ=[];REQS=[];TREQS=[];POSTS=[];NOTIF_S=[];NOTIF_T=[];MDETAIL={};MY_MENTOR_IDS=[];ME_ID='admin';ME_NAME='Global Link';return;}
  MENTORS=D.MENTORS;STUDENTS=D.STUDENTS;REQS=D.REQS;TREQS=D.TREQS;MDETAIL=D.MDETAIL;PLANS=D.PLANS;LIB=D.LIB;MYMATS0=D.MYMATS;PAST=D.PAST;GROUPS=D.GROUPS;EVENTS=D.EVENTS;POSTS=D.POSTS;SESS=D.SESS;BOOK_SLOTS=D.BOOK_SLOTS;TASKS=D.TASKS;MSTAT=D.MSTAT;MATS=D.MATS;CLASSES=D.CLASSES;RECAPS={};
  TH_S=D.TH;TH_T=D.TH;QS=D.QS;SHARED=D.SHARED;TQ=D.TQ;NOTIF_S=D.NOTIF;NOTIF_T=D.NOTIF;DATES=D.DATES;ME_ID=D.ME_ID;ME_NAME=L.me.name;ME_PHOTO='';MY_MENTOR_IDS=D.MY_MENTOR_IDS;
  const tut=L.me.role==='tutor';const hs=SESS.filter(x=>(x.wk||0)===0).map(x=>x.h);
  SH_LIVE=hs.length?[Math.max(0,Math.min(Math.floor(Math.min(...hs))-1,tut?13:7)),Math.min(24,Math.max(Math.ceil(Math.max(...hs))+2,tut?23:15))]:null;}
`;

export const METHODS = String.raw`
  // ---------- live accounts (API) ----------
  sync(path,body,quiet){if(!LIVE)return Promise.resolve(null);if(LIVE.readOnly){this.toast('You’re viewing this account read-only.','eye');return Promise.resolve(null);}
    return GLLive.api(path,body).then(r=>{this.refreshSoon();return r||{};}).catch(e=>{this.toast(e.message||'Something went wrong. Please try again.','circle-alert');if(e.status===401)this.signOut();return null;});}
  refreshSoon(){clearTimeout(this._rf);this._rf=setTimeout(()=>this.refresh(),350);}
  refresh(){if(!LIVE)return Promise.resolve();
    if(LIVE.kind==='admin')return GLLive.api('admin/data').then(A=>this.applyAdmin(A,false)).catch(e=>{if(e.status===401)this.signOut();});
    return GLLive.api('portal/bootstrap').then(B=>this.loadLive(B,false)).catch(e=>{if(e.status===401&&!LIVE.readOnly)this.signOut();});}
  resume(){const tok=GLLive.getToken();if(!tok){this.setState({stage:'signin'});return;}
    this.setState({stage:'sync',syncStep:0,signing:true,resuming:true});
    GLLive.api('auth/me').then(r=>this.startLive(r.user)).catch(e=>{if(e.status===401)GLLive.clearToken();this.setState({stage:'signin',signing:false,resuming:false,signErr:e.status===401?'':'We couldn’t reach Global Link. Check your connection, then sign in.'});});}
  startLive(user){
    if(user.role==='admin')return GLLive.api('admin/data').then(A=>{this.applyAdmin(A,true,user);this.startSync('admin');}).catch(e=>this.liveFail(e));
    return GLLive.api('portal/bootstrap').then(B=>{this.loadLive(B,true);this.startSync(B.me.role==='tutor'?'tutor':'student');}).catch(e=>this.liveFail(e));}
  liveFail(e){if(e&&e.status===401)GLLive.clearToken();setDemo();this.setState({stage:'signin',signing:false,signErr:(e&&e.message)||'Couldn’t load your account. Please try again.'});}
  loadLive(B,initial){const prevUnread=LIVE&&LIVE.D&&LIVE.D.TH?LIVE.D.TH.reduce((a,x)=>a+x.unread,0):null;
    const D=GLLive.mapMember(B,{TI,PACKS,GROUPS:DEMO_SNAP.GROUPS});setLive({kind:'member',me:B.me,B,D,readOnly:!!B.readOnly});
    const s=this.state,tut=B.me.role==='tutor',ids=TH_S.map(x=>x.id),st=B.state||{};
    const p={sessions:SESS.slice(),tasks:TASKS.map(t=>({...t})),thS:TH_S,thT:TH_T,qs:QS.slice(),tq:TQ.slice(),reqs:REQS.map(r=>({...r})),tReqs:TREQS.map(r=>({...r})),
      posts:POSTS.map(x=>({...x,comments:x.comments.slice()})),liked:D.liked,myMats:MYMATS0.map(m=>({...m})),tAssigned:D.tAssigned,matProg:D.matProg,users:[],mq:[],modQ:[],aLes:[],txns:[],audit:[],annHist:[],pkgs:[],ntTo:{},pastReq:{},aLib:null,
      flags:B.config.flags,maint:B.config.maint,announce:B.config.announce,count:D.nextStart?Math.max(0,Math.round((D.nextStart-Date.now())/1000)):0,
      activeS:ids.includes(s.activeS)?s.activeS:ids[0],activeT:ids.includes(s.activeT)?s.activeT:ids[0],
      selStudent:STUDENTS[s.selStudent]?s.selStudent:(Object.keys(STUDENTS)[0]||''),selClass:CLASSES.some(c=>c.id===s.selClass)?s.selClass:((CLASSES[0]||{}).id||''),
      replyFor:TQ.some(q=>q.id===s.replyFor)?s.replyFor:((TQ[0]||{}).id||null),askTo:MENTORS[s.askTo]&&(B.directory||[]).some(d=>d.id===s.askTo)?s.askTo:(((B.directory||[])[0]||{}).id||'')};
    if(B.config.announce&&LIVE.annText!==B.config.announce.t){p.annDismissed=false;}LIVE.annText=B.config.announce&&B.config.announce.t;
    if(initial){STATE_KEYS.forEach(k=>{if(st[k]!=null)p[k]=st[k];});p.toggles={...this.state.toggles,...(st.toggles||{})};
      p.avail=st.avail||{};p.savedWords=st.savedWords||[];p.sat=st.sat||{setup:false,date:'Not booked yet',has:false,goal:1400,tests:[]};p.satAns=st.satAns||[];
      p.joined=st.joined||{};p.savedP=st.savedP||{};p.pinned=st.pinned||{};p.rsvp=st.rsvp||{};p.prepNotes=st.prepNotes||{};p.displayName=B.me.name;p.notifRead=false;p.resuming=false;
      p.goal=st.goal||'';p.interests=st.interests||[];p.teaches=st.teaches||'';p.why=st.why||'';p.mTab='current';p.pastOpen=null;p.weekOff=0;p.matHl=[];p.call=null;
      p.lumiMsgs=[{from:'bot',t:tut?'Hi '+GLLive.first(B.me.name)+'! I can help you plan a lesson, find simple ways to explain a word, or practice what you’ll say.':'Hi '+GLLive.first(B.me.name)+'! Want a quick warm-up? Tell me one thing you did this week, in English.'}];}
    this.setState(p);
    try{if(window.glDesktop)window.glDesktop.setBadge(D.TH.reduce((a,x)=>a+x.unread,0));}catch(e){}
    if(prevUnread!=null){const now=D.TH.reduce((a,x)=>a+x.unread,0);if(now>prevUnread){const th=D.TH.find(x=>x.unread);this.toast('New message from '+(th?th.name:'Global Link'),'message-circle');this.notify('New message',(th?th.name+': ':'')+(th?String(th.msgs[th.msgs.length-1].t).slice(0,90):''));}}}
  applyAdmin(A,initial,user){const me=user||(LIVE&&LIVE.me)||{name:'Jordan Reyes'};const D=GLLive.mapAdmin(A,{GROUPS:DEMO_SNAP.GROUPS});setLive({kind:'admin',me,A,D});
    const p={users:USERS.map(u=>({...u})),audit:AUDIT0.slice(),mq:MQ0.slice(),aLes:LESSONS_A.map(l=>l.slice()),txns:[],pkgs:PKG0.map(x=>({...x})),modQ:MOD0.slice(),modRules:D.modRules,annHist:D.annHist,announce:D.announce,flags:D.flags,maint:D.maint,myMats:D.MYMATS,aLib:D.ALIB,payDone:false};
    if(initial){p.aNotes=D.notes;p.asAdmin=false;Object.assign(p,{sessions:[],tasks:[],thS:[],thT:[],qs:[],tq:[],reqs:[],tReqs:[],posts:[],tAssigned:[],matProg:{},liked:{},ntTo:{}});}this.setState(p);}
  signOut(){clearTimeout(this._saveT);GLLive.clearToken();setDemo();this.setState({...this.demoReset(),stage:'signin',meOpen:false,meTop:false,call:null,asAdmin:false,email:'',pw:'',otp:'',needOtp:false,signing:false,signErr:'',lumiOpen:false,palette:false,notifOpen:false,aUser:null,tourStep:null});}
  demoReset(){const I=this._init0||{};const o={};['sessions','tasks','thS','thT','qs','tq','reqs','tReqs','posts','users','audit','mq','aLes','txns','pkgs','modQ','annHist','myMats','tAssigned','matProg','satAns','sat','savedWords','liked','savedP','joined','rsvp','lumiMsgs','avail','flags','maint','announce','modRules','pinned','activeS','activeT','selStudent','selClass','replyFor','askTo','aNotes','count','displayName','pastReq'].forEach(k=>{o[k]=I[k];});o.aLib=null;return o;}
  enterDemo(role,fresh){setDemo();this.setState({...this.demoReset(),asAdmin:true,stage:'signin',call:null,meOpen:false,meTop:false,aUser:null});this.later(()=>{this.setState({email:role==='tutor'?'emma.carter@example.com':'mia.lin@example.com'});this.startSync(role,fresh);},30);}
  viewAs(au){if(au.role==='Parent'){this.toast('Parents don’t have a portal view yet.','info');return;}
    GLLive.api('admin/view-as',{id:au.id}).then(r=>{GLLive.setViewToken(r.token);return GLLive.api('portal/bootstrap');}).then(B=>{this.loadLive(B,true);this.setState({asAdmin:true,aUser:null});this.enterApp(B.me.role==='tutor'?'tutor':'student');this.setState({onboarded:true,stage:'app',clOpen:false,clHidden:true});this.toast('Viewing '+au.name+' as they see it. Read-only.','eye');})
      .catch(e=>{GLLive.setViewToken(null);this.toast(e.message||'Couldn’t open that account','info');});}
  backToAdmin(){GLLive.setViewToken(null);const page=LIVE&&LIVE.kind==='member'?'a_people':'a_dev';this.setState({asAdmin:false,call:null,meOpen:false,meTop:false});
    GLLive.api('admin/data').then(A=>GLLive.api('auth/me').then(r=>{this.applyAdmin(A,true,r.user);this.enterApp('admin');this.later(()=>this.setState({page}),20);})).catch(()=>this.signOut());}
  headFor(pg){const h=HEAD[pg]||['','',''];if(!LIVE)return h;const L=LIVE,admin=L.kind==='admin';const tz=admin?GLLive.BJ:(this.isT()?GLLive.CA:GLLive.BJ);const g=GLLive.greeting(tz);const zh={'Good morning':'早上好','Good afternoon':'下午好','Good evening':'晚上好'}[g];const f=GLLive.first(L.me.name);
    if(pg==='home'){const n=(this.state.sessions||[]).some(x=>x.next);return [g+', '+f,zh+'，'+f,n?'Here’s your day at a glance.':(MY_MENTOR_IDS.length?'Book your first lesson when you’re ready.':'Welcome! Let’s find you a mentor.')];}
    if(pg==='today'){const q=(this.state.tq||[]).length;return [g+', '+f,zh+'，'+f,q?q+' question'+(q===1?'':'s')+' waiting for you.':'Here’s what’s coming up.'];}
    if(pg==='a_overview')return [g+', '+f,zh+'，'+f,h[2]];return h;}
  viewSessLive(s){const t=this.isT(),L=LIVE.D;const pm=t?(STUDENTS[s.who]||MENTORS[s.who]||{name:'Student',photo:''}):(MENTORS[s.m]||{name:'Your mentor',photo:''});const person=pm.name;const rel=L.relLabel(s.start);
    return {...s,pd:s.d,ph:s.h,when:rel+', '+L.clock(s.start),time:L.clock(s.start),end:L.clock(s.start+s.dur*60000),rel,other:L.otherAt(s.start),person,personFirst:person.split(' ')[0],photo:pm.photo||'',note:(MENTORS[s.m]||{}).note||'pink',
      top:(s.h-SH(t)[0])*SROW+3,height:s.dur/60*SROW-6,isNext:!!s.next,isDone:!!s.done,isPlain:!s.next&&!s.done,open:()=>this.setState({sessFor:s.id})};}
  liveWeeks(){const now=Date.now(),W=7*864e5,out=[];for(let i=4;i>=0;i--){const a=now-(i+1)*W,b=now-i*W;const v=(this.state.sessions||[]).filter(x=>x.start&&x.done&&!x.requested&&x.start>=a&&x.start<b).reduce((m,x)=>m+x.dur,0);out.push({l:new Date(a+864e5).toLocaleDateString('en-US',{month:'short',day:'numeric'}),v});}return out;}
  liveNotes(){return (this.state.sessions||[]).filter(x=>x.feedback&&x.feedback.text).sort((a,b)=>b.start-a.start).slice(0,3).map((x,i)=>({m:x.m,color:x.feedback.color||'pink',tilt:[-2,1.5,-1][i],t:x.feedback.text}));}
  myStu(){return LIVE?{goal:this.state.goal||'Add your goal in Settings so your mentors know what to work on.',interests:(this.state.interests&&this.state.interests.length?this.state.interests:['Add your interests in Settings'])}:DEMO_SNAP.STUDENTS.mia;}
  daysTo(d){const t=Date.parse(d);if(!t)return null;return Math.max(0,Math.ceil((t-Date.now())/864e5));}
  todayShort(){return LIVE?new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Oct 7';}
  openSite(path){const u=SITE_URL+(path||'');if(window.glDesktop&&window.glDesktop.openExternal)window.glDesktop.openExternal(u);else window.open(u,'_blank','noopener');}
  notify(title,body){try{if(this.state.toggles&&this.state.toggles.quiet){const h=new Date().getHours();if(h>=22||h<7)return;}if(document.visibilityState==='visible')return;if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification(title,{body,icon:'assets/gl-mark.png'});}catch(e){}}
  poll(){if(!LIVE||this.state.stage!=='app'||this.state.call)return;const ra=LIVE.kind==='member'?LIVE.B&&LIVE.B.config&&LIVE.B.config.reloadAt:null;this.refresh().then(()=>{const nb=LIVE&&LIVE.B&&LIVE.B.config&&LIVE.B.config.reloadAt;if(ra&&nb&&nb!==ra){if(window.glDesktop&&window.glDesktop.checkForUpdates)window.glDesktop.checkForUpdates();location.reload();}});}
  checkUpdates(){const d=window.glDesktop;if(!d||!d.checkForUpdates){this.toast('The web app is always up to date ('+APP_VERSION+').','circle-check');return;}
    this.toast('Checking for updates…','refresh-cw');d.checkForUpdates().then(r=>{if(!r||!r.ok)this.toast(r&&r.reason==='dev'?'Updates only run in the installed app.':'Couldn’t check right now. We’ll try again later.','info');else if(r.version&&r.version!==(window.glApp||{}).version)this.toast('Downloading version '+r.version+'. It installs when you restart.','download');else this.toast('You’re up to date ('+((window.glApp||{}).version||APP_VERSION)+')','circle-check');});}
  testAV(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){this.toast('Camera and microphone aren’t available in this window.','info');return;}
    navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(st=>{const v=st.getVideoTracks().length,a=st.getAudioTracks().length;st.getTracks().forEach(t=>t.stop());this.toast((v&&a)?'Camera and microphone look good':'Found '+(v?'a camera':'no camera')+' and '+(a?'a microphone':'no microphone'),'circle-check');})
      .catch(e=>this.toast(e&&e.name==='NotAllowedError'?'Permission was blocked. Allow camera and microphone in your settings.':'No camera or microphone found.','info'));}
  icsFor(x){if(!x||!x.start){this.toast('Added to your calendar','calendar-plus');return;}const f=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Global Link//Portal//EN','BEGIN:VEVENT','UID:'+x.id+'@globallink','DTSTAMP:'+f(Date.now()),'DTSTART:'+f(x.start),'DTEND:'+f(x.start+x.dur*60000),'SUMMARY:'+(x.cls+' with '+x.person).replace(/[,;]/g,' '),'DESCRIPTION:Join from the Global Link app.','END:VEVENT','END:VCALENDAR'].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='global-link-lesson.ics';document.body.appendChild(a);a.click();a.remove();this.toast('Calendar file downloaded. Open it to add the lesson.','calendar-plus');}
  saveMatLive(B,item,status){if(!LIVE||B.review)return Promise.resolve(item.id);const admin=B.owner==='admin';
    return this.sync(admin?'admin/material':'portal/material',{id:/^\d+$/.test(String(item.id))?item.id:null,title:item.title,type:item.type,pack:item.pack,level:item.level,blocks:item.blocks,status:status||item.status}).then(r=>{if(!r||!r.id)return null;
      this.setState(x=>({bld:x.bld&&x.bld.id===item.id?{...x.bld,id:r.id,status:r.status||x.bld.status}:x.bld}));return r.id;});}
  liveWelcomeLumi(){const t=this.isT();const rq=t?this.state.tReqs:this.state.reqs;const open=rq.filter(r=>r.status===1||r.status===2).length,on=rq.filter(r=>r.status===3).length;
    if(t)return open?open+' student'+(open===1?' is':'s are')+' waiting to hear from you.':'No requests yet. Global Link will send students your way.';
    return on?'You have '+on+' mentor'+(on===1?'':'s')+' ready to teach you!':open?'We’re finding your mentor now. It usually takes a day or two.':'No mentor requests yet. You can ask for one from My mentors.';}
  liveVals(V){const s=this.state,t=this.isT(),L=LIVE,admin=L.kind==='admin';V.LIVE=true;V.DEMO=false;V.readOnly=!!L.readOnly;
    V.siteUrl=SITE_URL;V.appVersion=APP_VERSION;
    if(admin){this.adminLiveVals(V);return;}
    const D=L.D,me=L.me,nx=(s.sessions||[]).find(x=>x.next);const peerId=nx?(t?nx.who:nx.m):null;const peer=peerId?(STUDENTS[peerId]||MENTORS[peerId]||{name:'',first:''}):null;
    const nv=nx?this.viewSessLive(nx):null;
    V.lv={hasNext:!!nx,noNext:!nx,nextUpper:nv?('NEXT LESSON · '+nv.rel.toUpperCase()):'',nextCls:nv?nv.cls:'',nextTopic:nv?nv.topic:'',peerName:peer?peer.name:'',peerFirst:peer?(peer.first||GLLive.first(peer.name)):'',
      mine:nv?nv.time:'',mineDay:nv?nv.rel:'',other:nv?nv.other:'',city:t?'California':'Beijing',requested:!!(nx&&nx.requested),canJoin:!!(nx&&!nx.requested),
      hasMentors:MY_MENTOR_IDS.length>0,noMentors:!MY_MENTOR_IDS.length,emptyTitle:MY_MENTOR_IDS.length?'Book your first lesson':'Let’s find your mentor',
      emptySub:MY_MENTOR_IDS.length?'Your mentor is ready. Pick a time that works for you, in Beijing time.':'Tell us what you want help with. We match you with a bilingual American mentor, usually within two days.',
      goal:this.myStu().goal,hasGoal:!!s.goal,todoEmpty:V.todoTasks.length===0,upEmpty:V.upcoming.length===0,notes:this.liveNotes().map(n=>({...n,name:(MENTORS[n.m]||{first:''}).first})),
      prep:peerId&&s.prepNotes?s.prepNotes[peerId]||'':'',hasPrep:!!(peerId&&s.prepNotes&&s.prepNotes[peerId]),peerGoal:peer&&peer.goal?peer.goal:'',hasPeerGoal:!!(peer&&peer.goal&&peer.goal!=='Goal not shared yet'),
      lessonN:peerId?(s.sessions||[]).filter(x=>(t?x.who:x.m)===peerId&&x.done).length+1:0,feedbackDue:(s.sessions||[]).filter(x=>x.done&&!x.feedback&&x.lessonId).length,
      studsEmpty:Object.keys(STUDENTS).length===0,reqsWaiting:(s.tReqs||[]).filter(r=>r.status===1).length};
    V.lv.notesEmpty=V.lv.notes.length===0;V.lv.hasFeedbackDue=V.lv.feedbackDue>0;V.lv.nothingWaiting=!V.lv.hasFeedbackDue&&!V.hasTReqs&&!(V.tqTop||[]).length;V.goAvail=()=>this.go('availability');
    V.openReqHome=()=>{this.go('mentors');this.setState({reqOpen:true});};V.bookHome=()=>this.setState({bookOpen:true,bookSlot:null});V.goSettingsAcct=()=>{this.go('settings');this.setState({settingsTab:'account'});};
    V.viewPeer=()=>{if(peerId)this.setState({selStudent:peerId});this.go('students');};
    V.bookEmpty=V.bookSlots.length===0;V.bookEmptyMsg=MY_MENTOR_IDS.length?'No open times in the next two weeks. Message your mentor to find a time.':'Once you have a mentor, their open times show here.';
    V.weekEmptyMsg=V.days.every(d=>d.empty);V.noClasses=CLASSES.length===0;V.hasClasses=CLASSES.length>0;
    const cl=CLASSES.find(c=>c.id===s.selClass)||CLASSES[0];V.clsLessons=cl?cl.lessons.map(x=>({...x,hasFb:!!(x.feedback&&x.feedback.text),fb:x.feedback?x.feedback.text:'',fbColor:x.feedback?x.feedback.color||'pink':'pink',state:x.done?'Done':'Upcoming'})):[];V.clsLessonsEmpty=V.clsLessons.length===0;
    V.matsEmptyMsg=MATS.length?'Nothing matches that yet.':'When your mentors share materials, they show up here.';V.qsEmpty=(s.qs||[]).length===0;V.sharedEmpty=V.shared.length===0;
    V.weeksEmpty=V.weeks.every(w=>!w.v);V.wordsEmpty=V.words.length===0;V.notesEmpty=V.mentorNotes.length===0;V.mentorsEmpty=V.myMentors.length===0;V.pastEmpty=V.pastMentors.length===0;
    V.hasEvents=EVENTS.length>0;V.noEvents=!EVENTS.length;V.studsEmpty=V.studs.length===0;V.hasStuds=V.studs.length>0;V.satMentor='Your mentor';
    V.satSkills=[];V.satSkillsEmpty=true;V.satSections=V.satSections.map(x=>({...x,note:'Log practice tests to see where your points come from.'}));
    V.askCardName=t?((s.tq[0]&&V.tq[0])?V.tq[0].name:'No questions yet'):'Any mentor';V.askCardPhoto='';V.askCardSub=t?(s.tq.length?s.tq.length+' question'+(s.tq.length===1?'':'s')+' waiting for you':'Students’ questions land here'):'Text replies, usually within a day';
    V.linkedIcon=t?'badge-check':'user-round';V.linkedTitle=t?'Mentor account':'Student account';V.linkedSub='Shared with globallink.com. Parents connect from the website, and can’t read your messages.';
    V.username=me.username||'';V.emailShown=me.email;V.saveProfile=()=>{const n=(s.displayName||'').trim();if(n.length<2){this.toast('Enter your name','info');return;}if(LIVE.readOnly){this.toast('Read-only view','eye');return;}GLLive.api('auth/me',{name:n},{method:'PATCH'}).then(r=>{LIVE.me=r.user;this.toast('Saved. It shows on globallink.com too.','check');this.refreshSoon();}).catch(e=>this.toast(e.message,'info'));};
    V.changePw=()=>this.openSite('/#/login');V.editOnWeb=()=>this.openSite('/#/login');
    V.goalText=s.goal||'';V.setGoal=v=>this.setState({goal:v});V.interestsText=(s.interests||[]).join(', ');V.setInterests=v=>this.setState({interests:String(v).split(',').map(x=>x.trim()).filter(Boolean).slice(0,8)});
    V.teachesText=s.teaches||'';V.setTeaches=v=>this.setState({teaches:v});V.whyText=s.why||'';V.setWhy=v=>this.setState({why:v});
    V.callPeer=peer?peer.name:'';
    if(V.call){V.call={...V.call,mainName:peer?peer.name:'Your lesson',mainPhoto:'',selfName:GLLive.first(me.name),selfPhoto:'',mainBgImg:'none',showCap:false,popWord:false,popQuiz:false};V.preBring=t?'':'Have your notes ready';V.preWho=t?'will join soon':'will join soon';
      V.sendWordLabel=V.call.sentWord?'Sent ✓':'Send to '+(peer?peer.first||GLLive.first(peer.name):'student');V.wordsPanelS=false;V.toolsPanelT=false;V.wordsInLesson=[];
      const mins=Math.max(1,Math.round((V.call.secs||0)/60));V.endStats=[[String(mins),'minutes together'],['—','speaking time (coming soon)'],[String((s.savedWords||[]).length),'words saved']].map(([v,l],i)=>({v,l,delay:(i*.1+.1)+'s'}));}
    V.endTitle=t?'Leave '+(peer?GLLive.first(peer.name):'your student')+' a note':'Nice work, '+GLLive.first(me.name)+'!';V.peerFirst=peer?GLLive.first(peer.name):'';
    V.syncItems=['Your globallink.com profile','Your mentor requests',t?'Your students and availability':'Your bookings and lessons','Messages and materials'].map((x,i)=>({t:x,done:s.syncStep>i,op:s.syncStep>=i?1:.4,bg:s.syncStep>i?'var(--gl-success)':'var(--gl-line)'}));
    V.comStats=(D.MEMBERS||0).toLocaleString()+' MEMBERS';V.feedEmptyMsg=s.posts.length?'Nothing here yet.':'No posts yet. Be the first to say hi!';
    V.testNotif=()=>{let shown=false;try{if(s.notifPerm==='granted'){new Notification('Global Link',{body:'Lesson reminders and new messages will look like this.',icon:'assets/gl-mark.png'});shown=true;}}catch(e){}if(!shown)this.toast('Preview: “Lesson in 10 minutes”','bell');};
    const pf=peer?GLLive.first(peer.name):(t?'your student':'your mentor');
    V.T={...V.T,matsEmpty:V.matsEmptyMsg,feedEmpty:V.feedEmptyMsg,satSetup:'Tell us your test date, your latest score and your goal. Your mentor builds your practice around it, and every practice test you log updates this page.',satDiag:'No problem. Start with a full practice test from College Board’s Bluebook app, then log your score here.',satAsk:'Ask your mentor to cover it next lesson',quizWait:pf+' is answering',quizDone:pf+' got it right',wordPop:'Pops up on '+pf+'’s screen with sound and 中文.',slides:'Your slides',endTitle:V.endTitle,endSub:'Thanks for joining. Your mentor’s notes will show up on your home screen.',feelNote:'Your mentor sees this. It helps them plan the next lesson.',leaveTitle:V.endTitle,leaveSub:'It lands on their home screen as a sticky note. Short and kind works best.'};
    V.qs=V.qs.map(q=>({...q,showPlay:false,hasAns:!!q.ans}));V.showStuds=!V.studsEmpty||!t;V.studsEmptyPage=t&&V.studsEmpty;V.isTutorRole=t;
    V.devSims=[];V.devAccounts=[];V.aPayouts=[];V.cap=['','',''];
    V.clItems=V.clItems.map(x=>x.k==='hello'?{...x,t:t?'Say hi to your students':'Say hi to your mentor'}:x.k==='mentors'&&t?{...x,s:'Accept students Global Link sends you'}:x);}
  adminLiveVals(V){const s=this.state,D=LIVE.D,U=s.users||[];V.clockA=D.clockA;V.clockB=D.clockB;V.me={name:LIVE.me.name||'Admin',photo:'',sub:'Admin · Global Link'};
    const live=(s.aLes||[]).filter(l=>l[5]==='Live');const today=(s.aLes||[]).filter(l=>!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Tomorrow|Yesterday)/.test(l[0]));
    V.aLive=live.map(l=>({who:l[2]+' with '+l[3],cls:l[4]}));V.aHasLive=live.length>0;V.aNoLive=!live.length;
    const k=V.aKpis;const set=(i,v,sub)=>{if(k[i]){k[i].v=v;k[i].sub=sub;}};const stu=U.filter(u=>u.role==='Student'),men=U.filter(u=>u.role==='Mentor');const newToday=((D.signups||[])[(D.signups||[]).length-1]||{}).v||0;
    set(0,stu.length,newToday?newToday+' joined today':'No new sign-ups today');set(1,men.filter(u=>u.status==='Active').length+' active',men.filter(u=>u.status!=='Active').length+' paused');set(2,today.length,live.length?live.length+' live now':'None live right now');
    set(3,'¥0','Payments not built yet');set(4,(s.mq||[]).length,(s.mq||[]).length?'oldest '+s.mq[0].wait:'All caught up');set(5,(s.modQ||[]).length,'from the community');
    const go=pg=>()=>this.go(pg);V.aTodos=[].concat((s.mq||[]).length?[{t:(s.mq||[]).length+' student'+((s.mq||[]).length===1?'':'s')+' waiting for a mentor',s:'Oldest: '+s.mq[0].name+', '+s.mq[0].wait,icon:'git-merge',bg:'rgba(240,170,40,.16)',fg:'#c98a12',go:go('a_matching')}]:[],
      (s.modQ||[]).length?[{t:(s.modQ||[]).length+' community report'+((s.modQ||[]).length===1?'':'s'),s:'Review and decide',icon:'shield-alert',bg:'rgba(229,72,77,.12)',fg:'var(--gl-danger)',go:go('a_moderation')}]:[],
      (D.support||[]).length?[{t:D.support.length+' message'+(D.support.length===1?'':'s')+' to the team',s:'From '+D.support[0].name,icon:'message-circle',bg:'var(--gl-tint)',fg:'var(--gl-blue)',go:go('a_people')}]:[]);
    V.aTodoN=V.aTodos.length;V.aTodoEmpty=!V.aTodos.length;
    V.notifs=V.aTodos.map((x,i)=>({id:'an'+i,icon:x.icon,t:x.t,s:x.s,time:'',dot:!s.notifRead}));if(!V.notifs.length)V.notifs=[{id:'an0',icon:'circle-check',t:'All caught up',s:'Nothing needs you right now',time:'',dot:false}];V.hasUnreadNotif=V.aTodos.length>0&&!s.notifRead;
    V.aPayouts=[];V.aPayEmpty=true;V.aApprovePay=()=>this.toast('Payouts arrive with the payments system.','wallet');V.aPayPending=false;V.aTxnsEmpty=true;
    V.aInteg=[['Accounts shared with globallink.com','Working','var(--gl-success)'],['Lumi (Gemini, then OpenRouter)','Working','var(--gl-success)'],['Google sign-in','Not set up','var(--gl-faint)'],['WeChat sign-in and Pay','Not built yet','var(--gl-faint)'],['Video lessons','Preview only','#d99a00']].map(([l,st,dot])=>({l,s:st,dot}));
    V.aVers=[['Windows','monitor',APP_VERSION,'Updates automatically'],['macOS','laptop',APP_VERSION,'Updates automatically'],['Web','globe',APP_VERSION,'Always latest']].map(([l,icon,ver,on])=>({l,icon,ver,on,btn:l==='Web'?'Reload all':'Force update',force:()=>{this.sync('admin/config',{key:'reloadAt',value:Date.now(),audit:l==='Web'?'Reloaded all web sessions':'Asked '+l+' apps to check for updates',icon:'refresh-cw'});this.toast(l==='Web'?'Open portals refresh within a minute':l+' apps check for updates within a minute','refresh-cw');}}));
    V.devSims=V.devSims.filter((_,i)=>i===3);V.aSupport=(D.support||[]).map(x=>({...x,when:GLLive.ago(x.at),open:()=>{const u=(s.users||[]).find(y=>y.id===x.userId);if(u)this.setState({aUser:u.id,aMsgOpen:true,aMsgText:''});}}));V.aHasSupport=V.aSupport.length>0;
    const au=U.find(u=>u.id===s.aUser);V.aMsgOpen=!!s.aMsgOpen&&!!au;V.aMsgText=s.aMsgText||'';V.setAMsgText=v=>this.setState({aMsgText:v});V.aMsgThread=(s.aThread||[]).map(m=>({...m,them:!m.me,align:m.me?'end':'start'}));
    V.aMsgSend=()=>{const tx=(s.aMsgText||'').trim();if(!au||!tx)return;this.sync('admin/message',{to:au.id,text:tx}).then(ok=>{if(ok){this.setState({aMsgText:''});this.loadThread(au.id);this.toast('Sent to '+au.name+' as the Global Link team','send');}});};
    V.aMsgClose=()=>this.setState({aMsgOpen:false});}
  loadThread(id){GLLive.api('admin/thread?id='+encodeURIComponent(id)).then(r=>this.setState({aThread:r.msgs})).catch(()=>{});}
`;
