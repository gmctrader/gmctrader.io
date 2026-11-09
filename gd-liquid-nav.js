/* Ghost Discipline - floating "liquid glass" navigator (desktop, top of the screen).
   Standalone: one file, one <script> line. Replaces gd-dock.js (remove that script line).
   - Frosted-glass capsule that floats ~1cm below the top edge (--gdl-top: 19px on short screens, 38px max) and replaces the flat header links.
   - The brand and plan badge stay, aligned to the capsule; page content is pushed clear of it.
   - A liquid-glass lens sits over the active tab, taller than the bar, with refraction, a bright rim,
     and spring physics: it stretches as it travels and squashes when it lands.
   - Press and drag across the bar to scrub between tabs; release to go. Tap works too.
   - "More" opens a glass sheet under the capsule with every page (drag the grabber up, tap outside, or Esc to close).
   - Every button drives the existing sidebar buttons, so tier locks and demo locks still apply.
   - All class/id names use the gdl prefix so nothing can clash with the rest of the app. */
(function(){
  'use strict';
  var MQ = window.matchMedia('(min-width:961px) and (pointer:fine)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)');

  var TABS = [['dashboard','Overview'],['brief','Daily Brief'],['journal','Journal'],['analytics','Analytics'],['propfirm','Prop']];
  var GROUPS = [
    ['Today',   ['dashboard','brief','journal','analytics','rulebreaks']],
    ['Markets', ['calendar','orders','session']],
    ['Trading', ['tradeplan','reviewroom','playbook','stratnotes','backtest','psychology','rules']],
    ['Prop',    ['propfirm','proporders','propequity','propfirmrisk','propfirmpayout']],
    ['More',    ['team','elite','addfeatures','edgelab','pipx','scifeNavBtn','profile','packages','about','getAppBtn','signoutNavBtn']]
  ];
  var PIPX_ICON = '<svg viewBox="0 0 24 24"><path d="M5 4h11a2 2 0 012 2v13H7a2 2 0 01-2-2z"/><path d="M18 9h2v8a2 2 0 01-2 2"/><path d="M8 8h6M8 12h6M8 15h3"/></svg>';
  var MORE_ICON = '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>';

  var nav, bar, lens, log, scrim, sheet, built = false;
  var L = { x:0, w:0, vx:0, vw:0, press:0, raf:0, until:0, snap:true };
  var pressState = null;

  var css = '\
:root{--gdl-top:clamp(19px,3.4vh,38px)}\
#gdlNav,#gdlScrim,#gdlSheet{font-family:"IBM Plex Sans","Inter",-apple-system,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased}\
#gdlNav{position:fixed;left:50%;top:calc(var(--gdl-top) + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:120;display:flex;align-items:center;gap:12px;transition:opacity .25s ease,transform .5s cubic-bezier(.32,1.3,.5,1)}\
#gdlNav.off{opacity:0;pointer-events:none;transform:translate(-50%,-28px) scale(.94)}\
body:has(.overlay.show) #gdlNav{opacity:0;pointer-events:none}\
#gdlBar{position:relative;display:flex;align-items:center;gap:2px;padding:8px;border-radius:999px;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 24px 50px -20px rgba(0,0,0,.85),0 8px 18px -10px rgba(0,0,0,.55)}\
#gdlGlass{position:absolute;inset:0;z-index:0;border-radius:inherit;pointer-events:none;\
 background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.035) 46%,rgba(255,255,255,.06)),rgba(12,16,22,.44);\
 -webkit-backdrop-filter:blur(26px) saturate(1.9) brightness(1.06);backdrop-filter:blur(26px) saturate(1.9) brightness(1.06);\
 box-shadow:inset 0 1px 0 rgba(255,255,255,.36),inset 0 -1px 0 rgba(255,255,255,.07),inset 0 0 0 1px rgba(255,255,255,.1),inset 0 16px 24px -18px rgba(255,255,255,.22);transition:background .3s ease}\
#gdlGlass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;\
 background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(255,255,255,.1) 36%,rgba(255,255,255,.04) 64%,rgba(255,255,255,.3));\
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}\
html #gdlNav #gdlGlass{-webkit-backdrop-filter:blur(26px) saturate(1.9) brightness(1.06)!important;backdrop-filter:blur(26px) saturate(1.9) brightness(1.06)!important}\
#gdlNav.scrolled #gdlGlass{background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.035) 46%,rgba(255,255,255,.06)),rgba(10,13,19,.6)}\
#gdlLens{position:absolute;left:0;top:-9px;bottom:-9px;width:0;border-radius:34px;pointer-events:none;z-index:1;will-change:transform,width;opacity:0;\
 background:radial-gradient(130% 100% at 28% 0%,rgba(255,255,255,.26),rgba(255,255,255,.05) 52%,rgba(94,234,212,.07)),rgba(14,18,25,.5);\
 border:1px solid rgba(255,255,255,.3);\
 -webkit-backdrop-filter:blur(2px) saturate(1.9) brightness(1.18);backdrop-filter:blur(2px) saturate(1.9) brightness(1.18);\
 box-shadow:inset 0 2px 1px rgba(255,255,255,.55),inset 0 -2px 2px rgba(255,255,255,.1),inset 8px 10px 16px -10px rgba(255,255,255,.4),inset -8px -10px 16px -10px rgba(94,234,212,.28),\
 0 16px 36px -12px rgba(0,0,0,.7),0 0 26px -8px rgba(94,234,212,.22)}\
html:not([data-theme="light"]) #gdlNav #gdlLens{-webkit-backdrop-filter:blur(2px) saturate(1.9) brightness(1.18)!important;backdrop-filter:blur(2px) saturate(1.9) brightness(1.18)!important}\
@supports (backdrop-filter:url(#x)){html:not([data-theme="light"]) #gdlNav #gdlLens{backdrop-filter:blur(2px) saturate(1.9) brightness(1.18) url(#gdlLiquid)!important}}\
.gdl-item{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:7px;width:54px;height:52px;padding:0;border:0;border-radius:999px;background:transparent!important;box-shadow:none!important;\
 color:rgba(236,241,247,.74);cursor:pointer;overflow:hidden;white-space:nowrap;flex:none;-webkit-tap-highlight-color:transparent;\
 transition:width .5s cubic-bezier(.32,1.15,.5,1),color .2s ease,transform .3s cubic-bezier(.32,1.6,.5,1)}\
html:not([data-theme="light"]) .gdl-item{border:0!important;background-color:transparent!important}\
.gdl-item svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}\
.gdl-item svg circle{fill:currentColor;stroke:none}\
.gdl-item span{max-width:0;opacity:0;overflow:hidden;font-size:12.5px;font-weight:600;letter-spacing:.005em;transition:max-width .5s cubic-bezier(.32,1.15,.5,1),opacity .25s ease}\
.gdl-item:hover{color:#fff}\
.gdl-item.on{width:var(--gdl-w,112px);color:#fff}\
.gdl-item.on svg{color:#5eead4;filter:drop-shadow(0 0 8px rgba(94,234,212,.55))}\
.gdl-item.on span{max-width:var(--gdl-sw,70px);opacity:1}\
.gdl-item.locked{opacity:.55}\
.gdl-item:focus-visible,.gdl-log:focus-visible{outline:2px solid #5eead4;outline-offset:3px}\
.gdl-log{width:56px;height:56px;border-radius:50%;border:0!important;flex:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#06121a;\
 background:linear-gradient(145deg,#5eead4,#7c8cff)!important;\
 box-shadow:0 18px 32px -12px rgba(94,234,212,.5),0 1px 0 rgba(255,255,255,.55) inset!important;\
 transition:transform .3s cubic-bezier(.32,1.6,.5,1)}\
.gdl-log svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;transition:transform .35s cubic-bezier(.32,1.6,.5,1)}\
.gdl-log:hover svg{transform:rotate(90deg)}\
.gdl-log:active{transform:scale(.9)}\
\
#gdlScrim{position:fixed;inset:0;z-index:9100;background:rgba(2,4,8,.5);opacity:0;pointer-events:none;transition:opacity .3s ease}\
#gdlScrim.show{opacity:1;pointer-events:auto}\
#gdlSheet{position:fixed;left:50%;top:calc(var(--gdl-top) + env(safe-area-inset-top,0px) + 80px);z-index:9101;width:min(560px,calc(100vw - 24px));max-height:calc(100vh - var(--gdl-top) - 108px - env(safe-area-inset-top,0px));display:flex;flex-direction:column;\
 transform:translate(-50%,-16px) scale(.96);transform-origin:50% 0;opacity:0;visibility:hidden;pointer-events:none;\
 transition:transform .45s cubic-bezier(.32,1.2,.5,1),opacity .25s ease,visibility 0s linear .45s;border-radius:30px;overflow:hidden;\
 background:linear-gradient(180deg,rgba(30,36,46,.8),rgba(12,16,22,.9));-webkit-backdrop-filter:blur(30px) saturate(1.7);backdrop-filter:blur(30px) saturate(1.7);\
 border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px -20px rgba(0,0,0,.75),0 1px 0 rgba(255,255,255,.12) inset;color:#e8edf3}\
html #gdlSheet{-webkit-backdrop-filter:blur(30px) saturate(1.7)!important;backdrop-filter:blur(30px) saturate(1.7)!important}\
#gdlSheet.show{transform:translate(-50%,0) scale(1);opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}\
#gdlSheet.drag{transition:none}\
.gdl-grab{flex:none;display:flex;justify-content:center;padding:6px 0 10px;cursor:grab;touch-action:none}\
.gdl-grab i{width:40px;height:5px;border-radius:3px;background:rgba(255,255,255,.24)}\
.gdl-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:16px 20px 10px;touch-action:none}\
.gdl-head h3{margin:0;font-size:19px;font-weight:700;letter-spacing:-.01em}\
.gdl-head button{border:0!important;background:rgba(255,255,255,.09)!important;color:rgba(255,255,255,.75);width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer}\
.gdl-body{overflow:auto;padding:0 14px 8px;overscroll-behavior:contain}\
.gdl-sec{margin:14px 0 0}\
.gdl-sec h4{margin:0 0 7px 8px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.42)}\
.gdl-list{border-radius:18px;overflow:hidden;background:rgba(255,255,255,.06)}\
.gdl-row{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:0!important;background:transparent!important;box-shadow:none!important;color:inherit;font:500 14px/1.2 inherit;text-align:left;cursor:pointer;position:relative}\
.gdl-row+.gdl-row::before{content:"";position:absolute;top:0;left:56px;right:0;height:1px;background:rgba(255,255,255,.07)}\
.gdl-row:hover{background:rgba(255,255,255,.07)!important}\
.gdl-row:active{background:rgba(255,255,255,.13)!important}\
.gdl-ico{flex:none;width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08)}\
.gdl-ico svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\
.gdl-row.on{color:#5eead4}.gdl-row.on .gdl-ico{background:rgba(94,234,212,.18)}\
.gdl-lbl{flex:1}\
.gdl-tag{font-size:9px;font-weight:700;letter-spacing:.08em;color:#f5a623;border:1px solid rgba(245,166,35,.4);border-radius:6px;padding:2px 6px}\
.gdl-chev{width:14px;height:14px;fill:none;stroke:rgba(255,255,255,.28);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\
\
html.gdl-on #desktopNav#desktopNav{top:calc(var(--gdl-top) + env(safe-area-inset-top,0px))!important;height:68px!important;background:transparent!important;border:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;pointer-events:none}\
html.gdl-on #desktopNav#desktopNav::before,html.gdl-on #desktopNav#desktopNav::after{display:none!important}\
html.gdl-on #desktopNav#desktopNav .desktop-nav-links,html.gdl-on #desktopNav#desktopNav .desktop-nav-meta{display:none!important}\
html.gdl-on #desktopNav#desktopNav .desktop-nav-brand{pointer-events:auto;position:relative;padding:7px 18px 7px 8px;border-radius:999px;\
 background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.03)),rgba(12,16,22,.5);\
 -webkit-backdrop-filter:blur(22px) saturate(1.8)!important;backdrop-filter:blur(22px) saturate(1.8)!important;\
 box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 0 0 1px rgba(255,255,255,.1),0 16px 34px -16px rgba(0,0,0,.75)}\
html.gdl-on #planBadge{top:calc(var(--gdl-top) + env(safe-area-inset-top,0px) + 19px)!important}\
html.gdl-on #appShell.show>.main{margin-top:calc(var(--gdl-top) + 78px)!important;min-height:0!important}\
html.gdl-on #pfComplianceWrap{top:calc(var(--gdl-top) + 92px)!important}\
\
html[data-theme="light"] #gdlGlass{background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.42)),rgba(238,242,247,.5);box-shadow:inset 0 1px 0 #fff,inset 0 0 0 1px rgba(0,0,0,.08)}\
html[data-theme="light"] #gdlGlass::before{background:linear-gradient(135deg,rgba(255,255,255,.95),rgba(255,255,255,.2) 40%,rgba(0,0,0,.04) 70%,rgba(255,255,255,.7))}\
html[data-theme="light"] #gdlBar{box-shadow:0 22px 44px -22px rgba(20,30,50,.4)}\
html[data-theme="light"] .gdl-item{color:rgba(20,28,40,.6)}\
html[data-theme="light"] .gdl-item.on{color:#0b1220}\
html[data-theme="light"] .gdl-item.on svg{color:#0f766e;filter:none}\
html[data-theme="light"] #gdlLens{background:rgba(15,118,110,.1);border-color:rgba(15,118,110,.3);box-shadow:0 8px 20px -10px rgba(15,118,110,.4),inset 0 1px 1px rgba(255,255,255,.8)}\
html[data-theme="light"] #gdlSheet{background:linear-gradient(180deg,rgba(250,252,255,.9),rgba(238,242,247,.92));color:#0b1220;border-color:rgba(0,0,0,.08)}\
html[data-theme="light"] .gdl-list{background:#fff}\
html[data-theme="light"] #desktopNav#desktopNav .desktop-nav-brand{background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.42)),rgba(238,242,247,.5);box-shadow:inset 0 1px 0 #fff,inset 0 0 0 1px rgba(0,0,0,.08),0 16px 34px -18px rgba(20,30,50,.4)}\
@media (prefers-reduced-transparency:reduce){html #gdlNav #gdlGlass,html #gdlSheet,html.gdl-on #desktopNav#desktopNav .desktop-nav-brand{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:rgba(14,18,25,.96)!important}}\
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#gdlGlass,#gdlSheet,html.gdl-on #desktopNav#desktopNav .desktop-nav-brand{background:rgba(14,18,25,.94)}}\
@media (prefers-reduced-motion:reduce){#gdlNav,.gdl-item,.gdl-item span,#gdlSheet,#gdlScrim,.gdl-log,.gdl-log svg,#gdlGlass{transition:none!important}}';

  var FILTER = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>\
<filter id="gdlLiquid" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">\
<feTurbulence type="fractalNoise" baseFrequency="0.006 0.016" numOctaves="2" seed="7" result="n"/>\
<feGaussianBlur in="n" stdDeviation="1.2" result="nb"/>\
<feDisplacementMap in="SourceGraphic" in2="nb" scale="26" xChannelSelector="R" yChannelSelector="G"/>\
</filter></defs></svg>';

  /* ---------- sidebar helpers ---------- */
  function src(key){
    if(key==='pipx') return document.querySelector('.gdn-pipx');
    if(key==='scifeNavBtn'||key==='getAppBtn'||key==='signoutNavBtn') return document.getElementById(key);
    return document.querySelector('.side-navbtn[data-view="'+key+'"]');
  }
  function iconOf(key){ if(key==='pipx') return PIPX_ICON; var b = src(key), s = b && b.querySelector('svg'); return s ? s.outerHTML : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>'; }
  function labelOf(b){ var c = b.cloneNode(true); c.querySelectorAll('svg,.lock-badge,.gdn-tag').forEach(function(n){ n.remove(); }); return c.textContent.replace(/\s+/g,' ').trim().replace(/\s*VOICE$/,''); }
  function tagOf(b){ if(b.classList.contains('gdn-pipx')) return b.classList.contains('locked') ? 'PREMIUM' : ''; var t = b.querySelector('.lock-badge'); return t ? (t.textContent.replace(/[^\w]/g,'').trim() || 'PRO') : ''; }
  function activeView(){ var a = document.querySelector('.side-navbtn.active'); return a ? a.dataset.view : 'dashboard'; }
  function go(key){ var b = src(key); if(b) b.click(); closeSheet(); }
  function items(){ return Array.prototype.slice.call(bar.querySelectorAll('.gdl-item')); }

  /* ---------- build ---------- */
  function build(){
    if(built) return; built = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var holder = document.createElement('div'); holder.innerHTML = FILTER; document.body.appendChild(holder.firstChild);

    nav = document.createElement('div'); nav.id = 'gdlNav';
    bar = document.createElement('nav'); bar.id = 'gdlBar'; bar.setAttribute('aria-label','Quick navigation');
    var glass = document.createElement('div'); glass.id = 'gdlGlass'; glass.setAttribute('aria-hidden','true'); bar.appendChild(glass);
    lens = document.createElement('div'); lens.id = 'gdlLens'; lens.setAttribute('aria-hidden','true');
    bar.appendChild(lens);
    TABS.forEach(function(t){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gdl-item'; b.dataset.v = t[0]; b.setAttribute('aria-label', t[1]);
      b.innerHTML = iconOf(t[0]) + '<span>' + t[1] + '</span>'; bar.appendChild(b);
    });
    var more = document.createElement('button'); more.type = 'button'; more.className = 'gdl-item'; more.dataset.more = '1';
    more.setAttribute('aria-label','More pages'); more.setAttribute('aria-haspopup','dialog'); more.innerHTML = MORE_ICON + '<span>More</span>'; bar.appendChild(more);
    nav.appendChild(bar);

    log = document.createElement('button'); log.type = 'button'; log.className = 'gdl-log'; log.setAttribute('aria-label','Log a trade'); log.title = 'Log a trade';
    log.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'; nav.appendChild(log);
    document.body.appendChild(nav);

    scrim = document.createElement('div'); scrim.id = 'gdlScrim'; document.body.appendChild(scrim);
    sheet = document.createElement('div'); sheet.id = 'gdlSheet'; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-label','All pages'); document.body.appendChild(sheet);

    /* press, drag to scrub, release to go */
    bar.addEventListener('pointerdown', function(e){
      var it = e.target.closest('.gdl-item'); if(!it || e.button > 0) return;
      pressState = { x:e.clientX, moved:false, start:it, hover:it };
      try{ bar.setPointerCapture(e.pointerId); }catch(_){}
      run();
    });
    bar.addEventListener('pointermove', function(e){
      if(!pressState) return;
      if(Math.abs(e.clientX - pressState.x) > 6) pressState.moved = true;
      if(!pressState.moved) return;
      var it = nearest(e.clientX);
      if(it !== pressState.hover){ pressState.hover = it; preview(it); }
    });
    bar.addEventListener('pointerup', function(){
      if(!pressState) return;
      var p = pressState; pressState = null;
      var it = p.moved ? p.hover : p.start;
      activate(it); run();
    });
    bar.addEventListener('pointercancel', function(){ pressState = null; sync(); });
    bar.addEventListener('click', function(e){ if(e.detail !== 0) return; var it = e.target.closest('.gdl-item'); if(it) activate(it); }); /* keyboard Enter / Space */
    bar.addEventListener('keydown', function(e){
      if(e.key!=='ArrowRight' && e.key!=='ArrowLeft') return;
      var list = items(), i = list.indexOf(document.activeElement); if(i<0) return; e.preventDefault();
      list[(i + (e.key==='ArrowRight' ? 1 : list.length-1)) % list.length].focus();
    });
    log.addEventListener('click', function(){ closeSheet(); if(typeof openPretrade==='function') openPretrade(); });

    scrim.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeSheet(); }, true);

    var side = document.getElementById('sideNav') || document.querySelector('.sidebar');
    if(side){ var mo = new MutationObserver(sync); side.querySelectorAll('.side-navbtn').forEach(function(b){ mo.observe(b, { attributes:true, attributeFilter:['class'] }); }); }
    window.addEventListener('resize', function(){ apply(); measure(); L.snap = true; run(); });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ measure(); L.snap = true; run(); });
    var tint = function(){ nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', tint, { passive:true }); tint(); measure();
  }

  /* each tab expands to fit its own label */
  function measure(){
    items().forEach(function(b){
      var sp = b.querySelector('span'); if(!sp) return;
      var w = Math.ceil(sp.scrollWidth) + 2;
      b.style.setProperty('--gdl-sw', w + 'px');
      b.style.setProperty('--gdl-w', Math.max(98, 22 + 7 + w + 28) + 'px');
    });
  }
  function nearest(x){
    var best = null, bd = 1e9;
    items().forEach(function(b){ var r = b.getBoundingClientRect(), d = Math.abs(x - (r.left + r.width/2)); if(d < bd){ bd = d; best = b; } });
    return best;
  }
  function preview(it){ items().forEach(function(b){ b.classList.toggle('on', b === it); }); run(); }
  function activate(it){
    if(!it) return;
    if(it.dataset.more){ sync(); toggleSheet(); return; }
    if(it.dataset.v === activeView()){ sync(); return; }
    preview(it); go(it.dataset.v);
  }

  /* ---------- liquid lens: spring physics ---------- */
  function target(){
    var on = bar.querySelector('.gdl-item.on');
    return on ? { x:on.offsetLeft, w:on.offsetWidth } : null;
  }
  function run(){ L.until = performance.now() + 700; if(!L.raf) L.raf = requestAnimationFrame(tick); }
  function tick(){
    L.raf = 0;
    var t = target();
    if(!t){ lens.style.opacity = '0'; return; }
    lens.style.opacity = '1';
    var pressT = pressState ? 1 : 0;
    if(L.snap || REDUCED.matches){ L.x = t.x; L.w = t.w; L.vx = L.vw = 0; L.snap = false; L.press = pressT; }
    else {
      L.vx = (L.vx + (t.x - L.x) * .2) * .66;   L.x += L.vx;
      L.vw = (L.vw + (t.w - L.w) * .2) * .66;   L.w += L.vw;
      L.press += (pressT - L.press) * .25;
    }
    var speed = Math.abs(L.vx) + Math.abs(L.vw) * .5;
    var stretch = Math.min(speed / 55, .32);
    var sx = 1 + stretch + L.press * .06, sy = 1 - stretch * .55 + L.press * .06;
    lens.style.width = Math.max(0, L.w) + 'px';
    lens.style.transform = 'translateX(' + L.x.toFixed(2) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    var settled = Math.abs(t.x - L.x) < .15 && Math.abs(t.w - L.w) < .15 && Math.abs(L.vx) < .05 && Math.abs(L.vw) < .05 && Math.abs(L.press - pressT) < .01;
    if(!settled || performance.now() < L.until) L.raf = requestAnimationFrame(tick);
  }

  function sync(){
    if(!bar) return;
    var v = activeView(), inTabs = TABS.some(function(t){ return t[0] === v; });
    items().forEach(function(b){
      if(b.dataset.v){ b.classList.toggle('on', b.dataset.v === v); if(b.dataset.v === v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); var sb = src(b.dataset.v); b.classList.toggle('locked', !!(sb && sb.querySelector('.lock-badge'))); }
      else b.classList.toggle('on', !inTabs);
    });
    run();
  }

  /* ---------- bottom sheet ---------- */
  function buildSheet(){
    var v = activeView(), seen = {}, out = '';
    GROUPS.forEach(function(g){
      var rows = '';
      g[1].forEach(function(key){
        var b = src(key); if(!b || seen[key]) return; seen[key] = 1;
        var tag = tagOf(b);
        rows += '<button type="button" class="gdl-row'+(key===v?' on':'')+'" data-v="'+key+'"><span class="gdl-ico">'+iconOf(key)+'</span><span class="gdl-lbl">'+labelOf(b)+'</span>'+(tag?'<span class="gdl-tag">'+tag+'</span>':'')+'<svg class="gdl-chev" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg></button>';
      });
      if(rows) out += '<section class="gdl-sec"><h4>'+g[0]+'</h4><div class="gdl-list">'+rows+'</div></section>';
    });
    sheet.innerHTML = '<div class="gdl-head"><h3>All pages</h3><button type="button" data-close="1" aria-label="Close">✕</button></div><div class="gdl-body">'+out+'</div><div class="gdl-grab" aria-hidden="true"><i></i></div>';
    sheet.onclick = function(e){ if(e.target.closest('[data-close]')) return closeSheet(); var r = e.target.closest('.gdl-row'); if(r) go(r.dataset.v); };
    var drag = null;
    function down(e){ if(e.target.closest('button')) return; drag = { y:e.clientY, dy:0 }; sheet.classList.add('drag'); e.currentTarget.setPointerCapture(e.pointerId); }
    function move(e){ if(!drag) return; drag.dy = Math.max(0, drag.y - e.clientY); sheet.style.transform = 'translate(-50%,'+(-drag.dy)+'px)'; scrim.style.opacity = String(Math.max(0, 1 - drag.dy/360)); }
    function up(){ if(!drag) return; var d = drag.dy; drag = null; sheet.classList.remove('drag'); sheet.style.transform = ''; scrim.style.opacity = ''; if(d > 110) closeSheet(); }
    [sheet.querySelector('.gdl-grab'), sheet.querySelector('.gdl-head')].forEach(function(h){ h.addEventListener('pointerdown', down); h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); });
  }
  function toggleSheet(){ if(sheet.classList.contains('show')) closeSheet(); else openSheet(); }
  function openSheet(){ buildSheet(); scrim.classList.add('show'); sheet.classList.add('show'); var f = sheet.querySelector('.gdl-row.on, .gdl-row'); if(f) setTimeout(function(){ f.focus({ preventScroll:true }); }, 260); }
  function closeSheet(){ if(!sheet) return; sheet.classList.remove('show'); scrim.classList.remove('show'); sync(); }

  /* ---------- show / hide ---------- */
  function apply(){
    var shell = document.getElementById('appShell');
    var visible = MQ.matches && (!shell || shell.classList.contains('show'));
    document.documentElement.classList.toggle('gdl-on', !!visible);
    if(!visible){ if(built){ nav.classList.add('off'); closeSheet(); } return; }
    var first = !built; build(); nav.classList.remove('off'); if(first) L.snap = true; sync();
  }
  function init(){
    ['gdDock','gdOrb','gdSheet','gdNav','gdNavScrim','gdNavSheet'].forEach(function(id){ var n = document.getElementById(id); if(n) n.remove(); }); /* retire older navigators */
    /* Watch the shell from the start: it only gets .show after sign-in, which usually lands after this script runs. */
    var shell = document.getElementById('appShell');
    if(shell) new MutationObserver(apply).observe(shell, { attributes:true, attributeFilter:['class'] });
    window.addEventListener('load', apply);
    apply(); if(MQ.addEventListener) MQ.addEventListener('change', apply);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
