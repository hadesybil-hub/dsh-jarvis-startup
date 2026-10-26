/* Commander J.A.R.V.I.S boot. Original host/client integration: MIT, 沈宏宏. */
(function () {
  'use strict';
  if (window.__DSH_STARTUP_LOADED__) return;
  window.__DSH_STARTUP_LOADED__ = true;
  var C = Object.assign({enabled:true, mode:'always',bootWithInitialization:true,musicVolume:.72, identity:'Commander', identityId:'OPERATOR-001', accessLevel:'PRIME', speed:1, allowSkip:true, requireInteraction:false, sound:true, soundVolume:.28, voice:true, voiceVolume:.85}, window.__DSH_STARTUP__ || {});
  var root, stopped=false, started=false, ctx, activeAudio, music, musicRamp, timers=[], startTime, watchdog, previous, readyPoll,readySince=0,uiReady=false,audioBlocked=false;
  var stages=[
    ['唤醒智能核心','NEURAL CORE · INITIALIZING','核心序列已载入，等待指令。', 'CORE', 1],
    ['Commander · 身份已确认','PRIMARY OPERATOR · RECOGNIZED','本地身份配置已载入。', 'IDENTITY',2],
    ['建立指挥链路','COMMAND INTERFACE · SYNCHRONIZING','界面模块同步中。', 'LINK',3],
    ['载入工作界面','WORKSPACE INTERFACE · PREPARING','指挥界面准备完成。', 'READY',4],
    ['随时为您效劳','ALL SYSTEMS · ONLINE','J.A.R.V.I.S 已就绪。', 'ONLINE',5]
  ];
  stages[1][0]=C.identity+' · 身份已确认';
  function replay(){ finish(true);if(window.__JARVIS_NATIVE_REPLAY__){window.__JARVIS_NATIVE_REPLAY__();return;} window.__DSH_STARTUP_LOADED__=false;window.__DSH_STARTUP_SKIP__=false;var s=document.createElement('script');s.src='/dsh-startup/splash.js?t='+Date.now();document.head.appendChild(s); }
  window.__DSH_STARTUP_API__={replay:replay,skip:function(){finish();},finish:function(){finish();},config:C,voice:{name:'Microsoft Andrew Neural · spatial',lang:'en-US'},speak:function(en){tts(en);},speakName:function(){tts('Commander');}};
  if (!C.enabled || window.__DSH_STARTUP_SKIP__) { var old=document.getElementById('dsh-startup-root');if(old)old.remove();return; }
  function node(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function assetUrl(name){return window.__JARVIS_AUDIO_ASSETS__&&window.__JARVIS_AUDIO_ASSETS__[name]||'/dsh-startup/asset/'+name;}
  function later(fn,ms){var t=setTimeout(fn,ms);timers.push(t);return t;}
  function wait(ms){return new Promise(function(resolve){later(resolve,ms/Math.max(.35,Number(C.speed)||1));});}
  function tone(freq,length){if(!C.sound||!ctx||C.soundVolume===0)return;try{var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.72,ctx.currentTime+length);g.gain.setValueAtTime(Math.max(.0001,(C.soundVolume==null?.28:C.soundVolume)*.12),ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+length);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+length);}catch(e){}}
  function musicLevel(){return !C.sound?0:Math.max(0,Math.min(1,C.musicVolume==null?.72:C.musicVolume));}
  function needsAudioGesture(err){if(stopped||!err||err.name!=='NotAllowedError')return;audioBlocked=true;btn.hidden=false;btn.disabled=false;btn.textContent='开启声音';hint.textContent='动画正在自动加载；点击开启声音';}
  function unlockAudio(){if(!audioBlocked||stopped)return;audioBlocked=false;btn.hidden=true;if(music)music.play().then(function(){rampMusic(musicLevel(),350);}).catch(needsAudioGesture);if(ctx)ctx.resume().catch(function(){});hint.textContent='按 Esc 可跳过';}
  function rampMusic(target,ms){clearTimeout(musicRamp);if(!music||stopped)return;var from=music.volume,t0=Date.now();function tick(){if(!music||stopped)return;var p=Math.min(1,(Date.now()-t0)/ms);music.volume=Math.max(0,Math.min(1,from+(target-from)*p));if(p<1)musicRamp=setTimeout(tick,25);}tick();}
  function startMusic(){if(!C.sound||musicLevel()===0)return;music=new Audio(assetUrl('bgm-v2.mp3'));music.volume=0;music.loop=true;music.preload='auto';music.play().then(function(){if(stopped){music.pause();return;}rampMusic(musicLevel(),1200);}).catch(function(e){needsAudioGesture(e);if(!stopped)console.warn('[JARVIS music] playback unavailable',e);});}
  function tts(text){if(!C.voice||!text||!window.speechSynthesis)return;var u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.9;u.pitch=.85;u.volume=C.voiceVolume;var v=window.speechSynthesis.getVoices().find(function(v){return /david/i.test(v.name);});if(v)u.voice=v;window.speechSynthesis.speak(u);}
  function line(index){if(!C.voice||stopped)return Promise.resolve();return new Promise(function(resolve){var file=index==='ready'?'voice-us-ready.mp3':'voice-us-'+index+'.mp3';var a=new Audio(assetUrl(file));activeAudio=a;a.volume=C.voiceVolume;var end=false;function done(){if(end)return;end=true;clearTimeout(limit);a.pause();if(activeAudio===a)activeAudio=null;if(!stopped)rampMusic(musicLevel(),450);resolve();}var limit=later(done,12000);a.onplaying=function(){rampMusic(musicLevel()*.5,100);};a.onended=done;a.onerror=done;a.play().catch(function(e){needsAudioGesture(e);done();});});}
  function finish(immediate){if(stopped)return;stopped=true;clearTimeout(watchdog);clearTimeout(musicRamp);clearInterval(readyPoll);timers.forEach(clearTimeout);if(activeAudio){activeAudio.pause();activeAudio.removeAttribute('src');activeAudio.load();}if(music){music.pause();music.removeAttribute('src');music.load();}try{if(ctx)ctx.close();}catch(e){}try{window.speechSynthesis.cancel();}catch(e){}document.removeEventListener('keydown',key);if(root)root.remove();document.documentElement.classList.remove('dsu-lock');if(previous){document.documentElement.style.overflow=previous.html;if(document.body)document.body.style.overflow=previous.body;}try{sessionStorage.setItem('dsh-startup-screen:shown','1');localStorage.setItem('dsh-startup-screen:day',new Date().toISOString().slice(0,10));}catch(e){}window.__JARVIS_BOOT_STATUS__={finished:true,uiReady:uiReady,elapsed:started?Date.now()-startTime:0};}
  function key(e){if(e.key==='Escape'&&C.allowSkip){e.preventDefault();finish();}else if((e.key==='Enter'||e.key===' ')&&!started){e.preventDefault();run();}}
  function paintStage(i){if(stopped)return;root.dataset.phase=String(i);var s=stages[i];title.textContent=s[0];sub.textContent=s[1];log.textContent=s[2];phase.textContent='0'+(i+1)+' / 05   '+s[3];progress.style.width=((i+1)*20)+'%';items.forEach(function(n,k){n.classList.toggle('complete',k<i);n.classList.toggle('active',k===i);n.querySelector('b').textContent=k<i?'OK':k===i?'ACTIVE':'STANDBY';});tone(740+i*120,.14);}
  async function runLegacy(){if(started||stopped)return;started=true;startTime=Date.now();root.classList.add('j-running');btn.disabled=true;btn.hidden=true;hint.textContent='按 Esc 可跳过';startMusic();try{ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();}catch(e){}if(stopped)return;watchdog=later(function(){finish();},60000);for(var i=0;i<stages.length;i++){if(stopped)return;paintStage(i);await Promise.all([line(i+1),wait(i===4?2600:1650)]);}if(stopped)return;root.classList.add('j-ready');title.textContent='欢迎回来，'+C.identity;sub.textContent='J.A.R.V.I.S · AT YOUR SERVICE';await Promise.all([line(6),wait(3400)]);if(stopped)return;root.classList.add('j-exit');rampMusic(0,650);await wait(650);finish();}
  function observeReady(){var nativeReady=false;if(window.__JARVIS_NATIVE_BOOT__&&window.__DSH_BOOT_READY__?.promise)window.__DSH_BOOT_READY__.promise.then(function(){nativeReady=true;},function(){finish();});function check(){if(stopped)return;var app=document.getElementById('root');var shell=app&&app.querySelector('nav,[role="navigation"]');var controls=app&&app.querySelector('button');var backendReady=window.__JARVIS_NATIVE_BOOT__?nativeReady:window.__JARVIS_CLIENT_READY__===true;var ready=backendReady&&!!shell&&!!controls;if(ready){if(!readySince)readySince=Date.now();if(Date.now()-readySince>=700)uiReady=true;}else readySince=0;}check();readyPoll=setInterval(check,150);}
  async function runSynced(){
    if(started||stopped)return;started=true;startTime=Date.now();root.classList.add('j-running');btn.hidden=true;hint.textContent='DSH 正在后台初始化，完成后自动进入';
    startMusic();try{ctx=new (window.AudioContext||window.webkitAudioContext)();ctx.resume().catch(function(){});}catch(e){}
    observeReady();watchdog=later(function(){window.__JARVIS_BOOT_TIMEOUT__=true;finish();},60000);
    for(var i=0;i<4;i++){if(stopped)return;if(i>0&&uiReady)break;paintStage(i);await Promise.all([line(i+1),wait(1100)]);}
    if(stopped)return;
    if(!uiReady){title.textContent='等待工作界面就绪';sub.textContent='PREPARING YOUR WORKSPACE';log.textContent='界面仍在初始化，完成后自动进入';phase.textContent='WAITING FOR MAIN INTERFACE';progress.classList.add('j-waiting');}
    while(!uiReady&&!stopped)await wait(200);
    if(stopped)return;
    paintStage(4);progress.classList.remove('j-waiting');root.classList.add('j-ready');title.textContent='欢迎回来，'+C.identity;sub.textContent='WORKSPACE READY · AT YOUR SERVICE';log.textContent='工作界面已就绪';
    await Promise.all([line('ready'),wait(1400)]);if(stopped)return;root.classList.add('j-exit');rampMusic(0,650);await wait(650);finish();
  }
  function run(){return (C.bootWithInitialization?runSynced():runLegacy()).catch(function(err){console.warn('[JARVIS boot]',err);finish();});}
  function boot(){
    try {
      root=document.getElementById('dsh-startup-root')||node('div');root.id='dsh-startup-root';root.className='dsu-root j-root';if(!root.parentNode)document.body.appendChild(root);
      previous=window.__JARVIS_SCROLL_BEFORE_BOOT__||{html:document.documentElement.style.overflow,body:document.body.style.overflow};delete window.__JARVIS_SCROLL_BEFORE_BOOT__;
      document.documentElement.classList.add('dsu-lock');document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
      root.innerHTML='<div class="j-grid"></div><div class="j-scan"></div><div class="j-frame"></div><header class="j-header"><div><div class="j-brand">J.A.R.V.I.S</div><div class="j-small">JUST A RATHER VERY INTELLIGENT SYSTEM</div></div><div class="j-unit"><span class="j-indicator"></span> PRIVATE SYSTEM / LOCAL BOOT</div></header><aside class="j-left"><div class="j-label">OPERATOR PROFILE</div><div class="j-name"></div><dl><dt>IDENTIFIER</dt><dd></dd><dt>ACCESS CLASS</dt><dd></dd></dl><div class="j-profile-rule"></div><div class="j-small">PERSONAL COMMAND INTERFACE</div></aside><main class="j-main"><div class="j-core"><div class="j-orbit j-o1"></div><div class="j-orbit j-o2"></div><div class="j-orbit j-o3"></div><div class="j-core-dots"></div><div class="j-core-center"><span>J</span><small>NEURAL CORE</small></div></div><div class="j-phase">SYSTEM STANDBY</div><h1>贾维斯 · 等待唤醒</h1><div class="j-sub">READY WHEN YOU ARE</div><button class="j-start" type="button">启动贾维斯 <span>INITIALIZE SYSTEM →</span></button><div class="j-hint">点击或按 Enter 启动 · 启用声音</div></main><aside class="j-right"><div class="j-label">BOOT SEQUENCE</div><ol></ol><div class="j-telemetry"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="j-small">LOCAL STARTUP VISUALIZATION</div></aside><footer class="j-footer"><div class="j-log">启动界面已就绪。</div><div class="j-footer-row"><span>STANDING BY FOR COMMANDER</span><span class="j-clock"></span></div><div class="j-progress"><i></i></div></footer><button class="j-skip" type="button">跳过 · ESC</button>';
      root.querySelector('.j-name').textContent=C.identity;var dd=root.querySelectorAll('dd');dd[0].textContent=C.identityId;dd[1].textContent=C.accessLevel;
      title=root.querySelector('h1');sub=root.querySelector('.j-sub');log=root.querySelector('.j-log');phase=root.querySelector('.j-phase');progress=root.querySelector('.j-progress i');btn=root.querySelector('.j-start');hint=root.querySelector('.j-hint');
      items=stages.map(function(s,i){var li=node('li');li.appendChild(node('span','',('0'+(i+1))+'  '+s[3]));li.appendChild(node('b','','STANDBY'));root.querySelector('ol').appendChild(li);return li;});
      root.querySelector('.j-footer-row span').textContent='AT YOUR SERVICE · '+C.identity;
      function clock(){if(stopped)return;root.querySelector('.j-clock').textContent=new Date().toLocaleTimeString('en-GB',{hour12:false})+' / LOCAL';later(clock,1000);}clock();
      btn.addEventListener('click',function(){if(started)unlockAudio();else run();});var skip=root.querySelector('.j-skip');skip.hidden=!C.allowSkip;skip.addEventListener('click',function(){finish();});document.addEventListener('keydown',key);
      window.__JARVIS_BOOT_STATUS__={finished:false,identity:C.identity};
      // The wake button also unlocks browser audio; inactivity never traps the application.
      watchdog=later(function(){finish();},90000);
      if(C.bootWithInitialization||!C.requireInteraction)run();
    } catch(e){console.error('[JARVIS boot]',e);finish();}
  }
  var title,sub,log,phase,progress,btn,hint,items;
  if(window.__JARVIS_NATIVE_BOOT__)boot();else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
