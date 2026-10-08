// Component methods for the features added after the first release.
// Inserted into the design's component class together with live-methods.mjs.
export const METHODS_2 = String.raw`
  // ---------- Google sign-in ----------
  providers(){if(!this._prov)this._prov=GLLive.api('auth/providers').catch(()=>({}));return this._prov;}
  googleSignIn(){this.providers().then(p=>{if(!p||!p.google){this.toast('Google sign-in isn’t switched on yet. Use your globallink.com username and password.','log-in');return;}
    const d=window.glDesktop;if(d){d.openExternal(location.origin+'/api/auth/google?desktop=1');this.toast('Finish signing in with Google in your browser, then come back here.','log-in');}else location.href='/api/auth/google';});}
  handleAuthHash(){const h=location.hash||'';let m;
    if((m=/^#\/oauth\/([A-Za-z0-9_-]{20,})$/.exec(h))){history.replaceState(null,'',location.pathname+location.search);this.setState({stage:'sync',syncStep:0,signing:true,resuming:true});
      GLLive.api('auth/oauth',{code:m[1]}).then(r=>{GLLive.setToken(r.token,true);return this.startLive(r.user);}).catch(e=>this.setState({stage:'signin',signing:false,resuming:false,signErr:e.message}));return true;}
    if((m=/^#\/oauth-error\/([a-z-]+)(?:\/(.*))?$/.exec(h))){history.replaceState(null,'',location.pathname+location.search);
      const why={'no-account':'There’s no Global Link account for '+decodeURIComponent(m[2]||'that Google account')+' yet. Create one on globallink.com (you can sign up with Google there), then sign in here.',suspended:'This account is paused. Contact support@globallink.com.','not-configured':'Google sign-in isn’t switched on yet. Use your username and password.'}[m[1]]||'Google sign-in didn’t finish. Please try again.';
      this.setState({stage:'signin',signErr:why});return true;}
    return false;}
  handlePaidReturn(){const q=new URLSearchParams(location.search),id=q.get('paid');if(!id)return;history.replaceState(null,'',location.pathname+location.hash);
    if(id==='cancelled'){this.toast('Payment cancelled. Nothing was charged.','x');return;}
    GLLive.api('portal/checkout-status',{sessionId:id}).then(r=>{this.toast(r.paid?'Payment received. Your lesson credits are ready!':'We’re still confirming your payment. Credits appear as soon as it clears.',r.paid?'party-popper':'clock');this.refreshSoon();}).catch(()=>{});}

  // ---------- push notifications ----------
  b64key(s){const b=atob((s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0));}
  ensurePush(){try{const L=LIVE;if(!L||L.kind!=='member'||L.readOnly||!L.B||!L.B.vapid)return;
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||typeof Notification==='undefined'||Notification.permission!=='granted')return;
    navigator.serviceWorker.getRegistration().then(reg=>{if(!reg)return;return reg.pushManager.getSubscription().then(sub=>sub||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:this.b64key(L.B.vapid)})).then(sub=>GLLive.api('portal/push-subscribe',sub.toJSON()));}).catch(()=>{});}catch(e){}}
  dropPush(token){try{if(!('serviceWorker' in navigator))return;navigator.serviceWorker.getRegistration().then(reg=>reg&&reg.pushManager&&reg.pushManager.getSubscription()).then(sub=>{if(!sub)return;
    return GLLive.api('portal/push-unsubscribe',{endpoint:sub.endpoint},{token}).catch(()=>{}).then(()=>sub.unsubscribe());}).catch(()=>{});}catch(e){}}

  // ---------- recording (voice notes, video replies) ----------
  recStart(kind,task){if(LIVE&&LIVE.readOnly){this.toast('You’re viewing this account read-only.','eye');return;}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof MediaRecorder==='undefined'){this.toast('Recording isn’t supported in this browser. Try Chrome, Edge or Safari.','mic-off');return;}
    const video=kind==='video';this.recReset(true);
    navigator.mediaDevices.getUserMedia(video?{video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:true}:{audio:true}).then(st=>{
      const types=video?['video/mp4','video/webm;codecs=vp8,opus','video/webm']:['audio/mp4','audio/webm;codecs=opus','audio/webm'];
      const mime=types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||'';
      const rec=new MediaRecorder(st,Object.assign(mime?{mimeType:mime}:{},{audioBitsPerSecond:32000},video?{videoBitsPerSecond:250000}:{}));
      const chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
      rec.onstop=()=>{st.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:(rec.mimeType||mime||(video?'video/webm':'audio/webm')).split(';')[0]});
        if(this._rec){this._rec.blob=blob;this._rec.secs=Math.round((Date.now()-this._rec.started)/1000);this._rec.url=URL.createObjectURL(blob);}
        const v=document.getElementById('gl-rec-video');if(video&&v){v.srcObject=null;v.src=this._rec?this._rec.url:'';v.muted=false;v.controls=true;}};
      this._rec={kind,rec,stream:st,task:task&&task.taskId,taskTitle:task&&task.title,started:Date.now()};rec.start(1000);
      const v=document.getElementById('gl-rec-video');if(video&&v){v.srcObject=st;v.muted=true;v.controls=false;v.play().catch(()=>{});}
      clearTimeout(this._recT);this._recT=setTimeout(()=>this.recStop(),video?120000:180000);
      this.setState(video?{recOn:true,recSecs:0,recDone:false}:{taskRec:'rec',taskSecs:0});
    }).catch(e=>this.toast(e&&e.name==='NotAllowedError'?'Allow the '+(video?'camera and ':'')+'microphone to record.':'No '+(video?'camera':'microphone')+' found.','mic-off'));}
  recStop(){clearTimeout(this._recT);const r=this._rec;if(r&&r.rec&&r.rec.state!=='inactive')r.rec.stop();if(r)this.setState(r.kind==='video'?{recOn:false,recDone:true}:{taskRec:'done'});}
  recReset(quiet){clearTimeout(this._recT);const r=this._rec;if(r){try{if(r.rec.state!=='inactive')r.rec.stop();}catch(e){}r.stream.getTracks().forEach(t=>t.stop());}this._rec=null;
    const v=document.getElementById('gl-rec-video');if(v){v.srcObject=null;v.removeAttribute('src');v.controls=false;}if(!quiet)this.setState({taskRec:null,taskSecs:0,recOn:false,recDone:false,recSecs:0});}
  recUpload(){const r=this._rec;if(!r||!r.blob)return Promise.reject(new Error('Record something first.'));
    const ext=/mp4/.test(r.blob.type)?(r.kind==='video'?'mp4':'m4a'):'webm';
    return GLLive.upload(r.blob,{kind:r.kind==='video'?'video':'voice',name:(r.kind==='video'?'video-reply':'voice-note')+'.'+ext,type:r.blob.type,secs:r.secs});}
  recSendTask(){const r=this._rec;if(!r||!r.task)return;this.toast('Sending your voice note…','send');
    this.recUpload().then(file=>this.sync('portal/task',{op:'submit',id:r.task,file})).then(ok=>{if(ok){this.recReset();this.toast('Voice note sent to your mentor','send');}}).catch(e=>this.toast(e.message,'info'));}

  // ---------- files ----------
  pickFile(accept,cb){const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>{const f=i.files&&i.files[0];if(!f)return;if(f.size>4e6){this.toast('Files can be up to 4 MB.','info');return;}cb(f);};i.click();}
  attach(){if(!LIVE||LIVE.kind!=='member'){this.toast('Attachments work in real accounts.','paperclip');return;}if(LIVE.readOnly){this.toast('You’re viewing this account read-only.','eye');return;}
    const t=this.isT(),key=t?'thT':'thS',ak=t?'activeT':'activeS';const th=(this.state[key]||[]).find(x=>x.id===this.state[ak])||(this.state[key]||[])[0];if(!th)return;
    if(th.canSend===false){this.toast('You can message your mentors, your students and the Global Link team.','info');return;}
    this.pickFile('image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt',f=>{this.toast('Sending '+f.name+'…','upload');
      GLLive.upload(f,{kind:/^image\//.test(f.type)?'image':'file',name:f.name,type:f.type}).then(file=>this.sync('portal/message',{to:th.id,text:'',file})).then(r=>{if(r)this.toast('Sent','send');}).catch(e=>this.toast(e.message,'info'));});}
  uploadMaterial(){this.pickFile('.pdf,.doc,.docx,.ppt,.pptx,image/*,audio/*,video/*',f=>{this.toast('Uploading '+f.name+'…','upload');
    const type=/\.pdf$/i.test(f.name)?'PDF':/^video\//.test(f.type)?'Video':/^audio\//.test(f.type)?'Recording':/^image\//.test(f.type)?'Slides':'Reading';
    GLLive.upload(f,{kind:'material',name:f.name,type:f.type}).then(file=>this.sync('portal/material',{title:f.name.replace(/\.[^.]+$/,'').slice(0,150),type,pack:'free',level:'Intermediate',blocks:[{id:'b1',k:'m',text:f.name,file}],status:'Private'}))
      .then(r=>{if(r)this.toast('Uploaded to your materials','upload');}).catch(e=>this.toast(e.message,'info'));});}
  uploadToBuilder(){this.pickFile('image/*,audio/*,video/*,.pdf',f=>{this.toast('Uploading '+f.name+'…','upload');
    GLLive.upload(f,{kind:'material',name:f.name,type:f.type}).then(file=>{this.setState(x=>x.bld?{bld:{...x.bld,mode:'edit',blocks:x.bld.blocks.concat([{...bk('m',{text:f.name}),file}])}}:null);this.toast('Added to the material','check');}).catch(e=>this.toast(e.message,'info'));});}

  // ---------- buying lessons ----------
  openBuy(){if(!LIVE||LIVE.kind!=='member'||this.isT()){this.toast('Opening plans on globallink.com','external-link');return;}
    const pk=(LIVE.D.pkgs||[]).filter(p=>Number(p.price)>0);this.setState({buyOpen:true,buyPack:(pk[1]||pk[0]||{}).id,buySent:false});}
  buyNow(method){const s=this.state;if(LIVE&&LIVE.readOnly){this.toast('You’re viewing this account read-only.','eye');return;}if(!s.buyPack){this.toast('Pick a plan first','info');return;}
    GLLive.api('portal/buy',{packId:s.buyPack,method}).then(r=>{if(r.url){location.href=r.url;return;}this.setState({buySent:true});this.refreshSoon();}).catch(e=>this.toast(e.message,'info'));}
  buyVals(){const s=this.state,D=(LIVE&&LIVE.D)||{},info=D.payInfo||{};const NAMES={free:'Free lessons',conv:'Conversation',pron:'Pronunciation',ielts:'IELTS Speaking',sat:'SAT Math'};
    const packs=(D.pkgs||[]).filter(p=>Number(p.price)>0).map(p=>{const on=s.buyPack===p.id;return {name:p.name,price:Number(p.price).toLocaleString(),sub:p.credits+' lesson'+(p.credits===1?'':'s')+' · about ¥'+Math.round(Number(p.price)/Math.max(1,p.credits))+' each',bd:on?'var(--gl-blue)':'var(--gl-line)',bg:on?'var(--gl-tint)':'var(--gl-card)',dot:on?'var(--gl-blue)':'transparent',pick:()=>this.setState({buyPack:p.id,buySent:false})};});
    const ST={pending:['Waiting','#c98a12'],paid:['Paid','var(--gl-success)'],refunded:['Refunded','var(--gl-faint)'],cancelled:['Cancelled','var(--gl-faint)'],expired:['Expired','var(--gl-faint)']};
    return {credits:D.credits||0,packs,stripe:!!info.stripe,sent:!!s.buySent,notSent:!s.buySent,packsLabel:(D.packs||[]).length?'Includes: '+(D.packs||[]).map(k=>NAMES[k]||k).join(', '):'One credit is one 40-minute lesson',
      wechatText:'Most families pay us on WeChat. Send a request and we’ll message you the details'+(info.wechatId?' (our WeChat ID is '+info.wechatId+')':'')+'. Your lesson credits are added as soon as the payment arrives, usually within a day.',
      history:(D.payments||[]).slice(0,6).map(p=>({name:p.name,amount:Number(p.amount).toLocaleString(),when:GLLive.ago(p.at),status:(ST[p.status]||[p.status])[0],fg:(ST[p.status]||[0,'var(--gl-muted)'])[1]})),hasHistory:(D.payments||[]).length>0};}

  // ---------- events ----------
  openEventForm(){const d=new Date(Date.now()+3*864e5);d.setMinutes(0,0,0);const pad=n=>String(n).padStart(2,'0');
    this.setState({evFormOpen:true,evf:{title:'',kind:'Live Q&A',when:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':00',dur:45,link:'',body:''}});}
  evfVals(){const f=this.state.evf||{},up=p=>this.setState(x=>({evf:{...(x.evf||{}),...p}}));
    return {...f,setTitle:v=>up({title:v}),setLink:v=>up({link:v}),setBody:v=>up({body:v}),setWhen:e=>up({when:e.target.value}),
      kinds:['Live Q&A','Workshop','Club','Social'].map(l=>({l,variant:f.kind===l?'selected':'soft',pick:()=>up({kind:l})})),
      durs:[30,45,60,90].map(n=>({l:n+' min',variant:f.dur===n?'selected':'soft',pick:()=>up({dur:n})})),
      post:()=>{const start=new Date(f.when).getTime();this.sync(LIVE&&LIVE.kind==='admin'?'admin/event':'portal/event',{title:f.title,kind:f.kind,start,dur:f.dur,link:f.link,body:f.body}).then(r=>{if(r){this.setState({evFormOpen:false});this.toast('Event posted','calendar-check');}});}};}

  // ---------- AI Practice ----------
  practiceVals(){const s=this.state,today=new Date().toISOString().slice(0,10),pr=s.practice||{},done=pr.day===today?(pr.done||[]):[],words=s.savedWords||[];
    const N=[['warm','Daily warm-up','Tell Lumi about your day','sparkles','Start a warm-up chat with me. Ask me one simple question about my day, then gently correct one mistake in my answer.'],
      ['words','Word review',words.length?words.length+' saved words':'Save words from lessons first','languages',words.length?'Quiz me on these words one at a time, with a Chinese hint: '+words.slice(-12).join(', ')+'.':'Teach me 5 useful everyday English words with their Chinese meanings, then quiz me on them.'],
      ['story','Telling a story','Past tense practice','book-open','Help me tell a short story about something I did last weekend, in the past tense. Ask me one question at a time.'],
      ['interview','Interview basics','For school and college interviews','mic','Pretend to be a friendly college interviewer. Ask me one interview question at a time and give me short feedback.'],
      ['review','Mixed review','A bit of everything','award','Give me a short mixed review: one vocabulary question, one grammar question and one speaking prompt about my goal: '+(s.goal||'speaking English with confidence')+'.']];
    const days=new Set(pr.days||[]);let streak=0;for(let i=0;i<400;i++){const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10);if(days.has(d))streak++;else if(i>0)break;}
    return {streakLabel:streak?streak+'-day streak':'Start your streak today',nodes:N.map(([id,label,sub,icon,prompt])=>{const ok=done.includes(id);
      return {label,sub,icon,state:ok?'DONE TODAY':'START',stateFg:ok?'var(--gl-success)':'var(--gl-link)',bd:ok?'rgba(34,165,101,.4)':'var(--gl-line)',bg:ok?'rgba(34,165,101,.06)':'var(--gl-card)',iconBg:ok?'var(--gl-success)':'var(--gl-tint)',iconFg:ok?'#fff':'var(--gl-blue)',
        go:()=>{this._practiceId=id;this.setState({lumiDraft:prompt});this.toast('Lumi is ready. Press send to start.','sparkles');}};})};}
  markPractice(){const id=this._practiceId;if(!id)return;this._practiceId=null;const today=new Date().toISOString().slice(0,10);
    this.setState(x=>{const pr=x.practice||{},done=pr.day===today?(pr.done||[]):[];return {practice:{day:today,done:Array.from(new Set(done.concat([id]))),days:(pr.days||[]).filter(d=>d!==today).concat([today]).slice(-90)}};});}

  // ---------- material viewer ----------
  matViewer(){const s=this.state,m=s.matOpen?MATS.find(x=>x.id===s.matOpen):null;if(!LIVE||!m||!m.blocks||!m.blocks.length)return {has:false};
    const ans=(s.matAns||{})[m.id]||{},bid=(b,i)=>b.id||('b'+i),qs=m.blocks.map((b,i)=>[b,bid(b,i)]).filter(([b])=>b.k==='q'),answered=qs.filter(([,id])=>ans[id]!==undefined).length;
    const blocks=m.blocks.map((b,i)=>{const id=bid(b,i),a=ans[id],f=b.file||null,ok=b.ok||0;
      return {text:b.text||'',zh:b.zh||'',ex:b.ex||'',isH:b.k==='h',isT:b.k==='t',isQ:b.k==='q',isV:b.k==='v',isP:b.k==='p',isM:b.k==='m',answered:a!==undefined,res:a===ok?'Correct!':'Not quite. The answer is '+'ABC'[ok]+'.',resFg:a===ok?'var(--gl-success)':'var(--gl-danger)',
        secL:(b.sec||60)>=60?Math.round((b.sec||60)/60)+' min':b.sec+' sec',say:()=>this.say(b.text||''),url:f?f.url:'',name:f?f.name:'',
        isImage:!!(f&&/^image\//.test(f.type)),isAudio:!!(f&&/^audio\//.test(f.type)),isVideo:!!(f&&/^video\//.test(f.type)),isDoc:!!(f&&!/^(audio|image|video)\//.test(f.type)),
        opts:(b.opts||[]).map((t,oi)=>({t:t||'Choice '+(oi+1),letter:'ABC'[oi],bd:a!==undefined&&oi===ok?'var(--gl-success)':a===oi?'var(--gl-danger)':'var(--gl-line)',bg:a!==undefined&&oi===ok?'rgba(34,165,101,.12)':a===oi?'rgba(229,72,77,.1)':'var(--gl-card)',
          pick:()=>{if(a!==undefined)return;const na={...ans,[id]:oi},n=qs.filter(([,q])=>na[q]!==undefined).length,pct=Math.round(n/Math.max(1,qs.length)*100);
            this.setState(x=>({matAns:{...(x.matAns||{}),[m.id]:na},matProg:{...(x.matProg||{}),[m.id]:Math.max(pct,(x.matProg||{})[m.id]||0)}}));
            if(m.asgId&&!(LIVE&&LIVE.readOnly))GLLive.api('portal/progress',{id:m.asgId,progress:pct}).catch(()=>{});}}))};});
    return {has:true,blocks,progressLabel:qs.length?answered+' of '+qs.length+' questions answered':'Nothing to answer here. Read or watch it, then you’re done.'};}

  // ---------- extra values on top of liveVals() ----------
  liveVals2(V){const s=this.state,t=this.isT(),admin=LIVE.kind==='admin';
    V.openEventForm=()=>this.openEventForm();V.closeEventForm=()=>this.setState({evFormOpen:false});V.evFormOpen=!!s.evFormOpen;V.evf=this.evfVals();
    if(admin){this.adminLiveVals2(V);return;}
    V.attachFile=()=>this.attach();V.T={...V.T,recBg:'#0c1730',matW:'600px'};
    const r=this._rec;
    V.tasksShown=V.tasksShown.map(k=>{const mine=!!(r&&r.task&&r.task===k.taskId);return {...k,startRec:()=>this.recStart('task',k),recIdle:!!k.isRec&&!(mine&&s.taskRec),recOn:!!k.isRec&&mine&&s.taskRec==='rec',recReady:!!k.isRec&&mine&&s.taskRec==='done'};});
    V.stopTaskRec=()=>this.recStop();V.redoTaskRec=()=>this.recReset();V.submitTaskRec=()=>this.recSendTask();
    V.startRec=()=>this.recStart('video');V.stopRec=()=>this.recStop();V.redoRec=()=>this.recReset();
    const rq=V.rq&&V.rq.qid?V.rq:null,textSend=V.sendReply;
    if(rq&&rq.isVideo)V.sendReply=()=>{if(!this._rec||!this._rec.blob){this.toast('Record your reply first','video');return;}this.toast('Sending your video…','send');
      this.recUpload().then(file=>this.sync('portal/answer',{id:rq.qid,text:(s.replyText||'').trim(),video:file})).then(ok=>{if(ok){this.recReset();this.setState({replyText:''});this.toast('Video reply sent to '+rq.first,'send');}}).catch(e=>this.toast(e.message,'info'));};
    else V.sendReply=textSend;
    V.qs=V.qs.map(q=>({...q,showPlay:q.answered&&!!q.video}));
    V.events=V.events.map(e=>({...e,hasLink:!!e.link}));V.canHostEvent=t;
    V.buyOpen=!!s.buyOpen;V.buy=this.buyVals();V.openBuy=()=>this.openBuy();V.closeBuy=()=>this.setState({buyOpen:false});V.buyWechat=()=>this.buyNow('wechat');V.buyStripe=()=>this.buyNow('stripe');
    V.lk={...V.lk,buy:()=>this.openBuy()};
    V.pr=this.practiceVals();V.mv=this.matViewer();
    const ms=s.matOpen?MATS.find(x=>x.id===s.matOpen):null,mf=ms&&(ms.blocks||[]).find(b=>b.file);
    V.matDownload=()=>{if(mf)window.open(mf.file.url,'_blank','noopener');else this.toast('This material opens right here in the app.','book-open');};
    V.askPerm=()=>{try{Notification.requestPermission().then(p=>{this.setState({notifPerm:p});if(p==='granted'){this.markSetup('notif');this.ensurePush();this.toast('Notifications are on','bell');}});}catch(e){this.setState({notifPerm:'unsupported'});}};
    if(t){V.libUpload=()=>this.uploadMaterial();V.bldUpload=()=>this.uploadToBuilder();}}
  adminLiveVals2(V){const s=this.state,A=LIVE.A||{},R=s.apRec||{},up=p=>this.setState(x=>({apRec:{...(x.apRec||{}),...p}}));
    const pays=A.payments||[],month=new Date().toISOString().slice(0,7),money=n=>'¥'+Number(n||0).toLocaleString();
    const MT={wechat:'WeChat',stripe:'Card / Stripe',alipay:'Alipay',cash:'Cash',bank:'Bank transfer'},ST={pending:['WAITING','#c98a12'],paid:['PAID','var(--gl-success)'],refunded:['REFUNDED','var(--gl-faint)'],cancelled:['CANCELLED','var(--gl-faint)'],expired:['EXPIRED','var(--gl-faint)']};
    const recv=pays.filter(p=>p.status==='paid'&&new Date(p.paidAt||p.at).toISOString().slice(0,7)===month).reduce((a,p)=>a+p.amount,0);
    const due=(A.payouts||[]).filter(p=>!p.paid).reduce((a,p)=>a+p.amount,0);
    const pkgs=(A.config&&A.config.pkgs)||[];
    V.ap={kpis:[['RECEIVED THIS MONTH',money(recv),pays.filter(p=>p.status==='paid').length+' paid in total'],['WAITING FOR PAYMENT',pays.filter(p=>p.status==='pending').length,'requests from the app'],['MENTOR PAYOUTS DUE','$'+due,'finished lessons not yet paid']].map(([l,v,s2])=>({l,v,s:s2})),
      stripeLine:A.stripe?'Card, Alipay and WeChat Pay through Stripe are on in the app.':'Paying by card in the app (Stripe) is off until STRIPE_SECRET_KEY is set.',
      pending:pays.filter(p=>p.status==='pending').map(p=>({...p,amount:Number(p.amount).toLocaleString(),when:GLLive.ago(p.at),confirm:()=>this.sync('admin/payment',{op:'confirm',id:p.id}).then(ok=>{if(ok)this.toast('Payment recorded. '+p.credits+' credits added for '+p.who,'wallet');}),cancel:()=>this.sync('admin/payment',{op:'cancel',id:p.id})})),
      all:pays.filter(p=>p.status!=='pending').slice(0,60).map(p=>({...p,amount:Number(p.amount).toLocaleString(),method:MT[p.method]||p.method,when:GLLive.ago(p.paidAt||p.at),status:(ST[p.status]||[p.status])[0],fg:(ST[p.status]||[0,'var(--gl-muted)'])[1],deco:p.status==='refunded'?'line-through':'none',canRefund:p.status==='paid',refund:()=>this.sync('admin/payment',{op:'refund',id:p.id}).then(ok=>{if(ok)this.toast('Refunded. Credits removed.','undo-2');})})),
      studentOpts:(s.users||[]).filter(u=>u.role==='Student').map(u=>({value:u.id,label:u.name})),packOpts:pkgs.map(p=>({value:p.id,label:p.name+' · ¥'+p.price})),
      recUser:R.user,recPack:R.pack,recAmount:R.amount||'',recNote:R.note||'',setRecUser:v=>up({user:v}),setRecPack:v=>{const p=pkgs.find(x=>x.id===v);up({pack:v,amount:p?String(p.price):''});},setRecAmount:v=>up({amount:String(v).replace(/[^0-9]/g,'')}),setRecNote:v=>up({note:v}),
      record:()=>{if(!R.user||!R.pack){this.toast('Pick a student and a plan','info');return;}this.sync('admin/payment',{op:'record',userId:R.user,packId:R.pack,amount:Number(R.amount||0),note:R.note||''}).then(ok=>{if(ok){this.setState({apRec:{}});this.toast('Payment recorded and credits added','wallet');}});},
      payouts:(A.payouts||[]).map(p=>({...p,unpaid:!p.paid,pay:()=>this.sync('admin/payout',{tutorId:p.tutorId,month:p.month}).then(ok=>{if(ok)this.toast('Payout marked paid. '+p.name+' was told.','wallet');})})),rateLabel:'$'+(A.rate||20)+' a lesson'};
    V.ap.pendingEmpty=!V.ap.pending.length;V.ap.allEmpty=!V.ap.all.length;V.ap.payoutsEmpty=!V.ap.payouts.length;
    V.aEvents=(A.events||[]).map(e=>({...e,when:new Date(e.start).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),remove:()=>this.sync('admin/event',{op:'delete',id:e.id})}));V.aEventsEmpty=!V.aEvents.length;}
`;
