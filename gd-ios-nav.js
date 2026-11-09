/* Ghost Discipline - floating iOS-style navigator (desktop).
   Replaces gd-dock.js.
   - Floating capsule tab bar: icon over label, a sliding "lens" under the active tab, spring press feedback.
   - Shrinks to the active tab while you scroll down (like the iOS tab bar) and re-expands on scroll up,
     hover or tap.
   - Detached round "Log a trade" button beside the capsule.
   - "More" opens an iOS bottom sheet: grabber, grouped rows, drag down (or tap outside / Esc) to close.
   - Every button drives the existing sidebar buttons, so tier locks, demo locks and renders still apply.
   - Ink surfaces to match the portal theme (no blur needed). Safe to remove: delete the script tag. */
(function(){
  'use strict';
  var MQ = window.matchMedia('(min-width:961px) and (pointer:fine)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)');

  var TABS = [
    ['dashboard','Overview'], ['journal','Journal'], ['analytics','Analytics'],
    ['orders','Orders'], ['propfirm','Prop']
  ];
  var GROUPS = [
    ['Today',   ['dashboard','brief','journal','analytics','rulebreaks']],
    ['Markets', ['calendar','orders','session']],
    ['Trading', ['tradeplan','reviewroom','playbook','stratnotes','backtest','psychology','rules']],
    ['Prop',    ['propfirm','proporders','propequity','propfirmrisk','propfirmpayout']],
    ['More',    ['team','elite','addfeatures','edgelab','scifeNavBtn','profile','packages','about','getAppBtn']]
  ];

  var nav, bar, lens, sheet, scrim, sheetPanel, built = false, mini = false, lensRaf = 0;
  var MORE_ICON = '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>';

  var css = '\
#gdNav,#gdNavScrim,#gdNavSheet{font-family:"IBM Plex Sans","Inter",-apple-system,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased}\
#gdNav{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:90;display:flex;align-items:center;gap:10px;\
 transition:opacity .25s ease,transform .45s cubic-bezier(.32,1.3,.5,1)}\
#gdNav.off{opacity:0;pointer-events:none;transform:translate(-50%,24px) scale(.94)}\
body:has(.overlay.show) #gdNav{opacity:0;pointer-events:none}\
#gdNavBar{position:relative;display:flex;align-items:center;padding:6px;border-radius:999px;\
 background:linear-gradient(180deg,rgba(34,40,50,.96),rgba(18,22,29,.96));\
 border:1px solid rgba(255,255,255,.1);\
 box-shadow:0 22px 48px -18px rgba(0,0,0,.85),0 2px 0 rgba(255,255,255,.05) inset,0 -1px 0 rgba(0,0,0,.4) inset;\
 -webkit-backdrop-filter:blur(24px) saturate(1.8);backdrop-filter:blur(24px) saturate(1.8)}\
#gdNavLens{position:absolute;top:6px;bottom:6px;left:0;width:0;border-radius:999px;pointer-events:none;\
 background:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.07));\
 box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 6px 16px -8px rgba(0,0,0,.7);\
 transition:transform .5s cubic-bezier(.32,1.25,.5,1),width .5s cubic-bezier(.32,1.25,.5,1),opacity .2s}\
#gdNavLens.none{opacity:0}\
.gdn-item{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:68px;height:54px;padding:0 10px;border:0;border-radius:999px;\
 background:transparent;color:rgba(235,240,246,.62);cursor:pointer;overflow:hidden;max-width:96px;white-space:nowrap;\
 transition:color .2s ease,transform .3s cubic-bezier(.32,1.6,.5,1),max-width .4s cubic-bezier(.32,1,.5,1),min-width .4s cubic-bezier(.32,1,.5,1),padding .4s cubic-bezier(.32,1,.5,1),opacity .25s ease}\
.gdn-item svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;transition:transform .35s cubic-bezier(.32,1.6,.5,1)}\
.gdn-item svg circle{fill:currentColor;stroke:none}\
.gdn-item span{font-size:10px;font-weight:600;letter-spacing:.01em;line-height:1;transition:opacity .2s ease,max-height .3s ease;max-height:12px}\
.gdn-item:hover{color:#fff}\
.gdn-item:active{transform:scale(.9)}\
.gdn-item.on{color:#5eead4}\
.gdn-item.on svg{transform:translateY(-.5px) scale(1.06)}\
.gdn-item.locked{opacity:.55}\
.gdn-item:focus-visible,.gdn-log:focus-visible{outline:2px solid #5eead4;outline-offset:2px}\
#gdNav.mini .gdn-item:not(.on){min-width:0;max-width:0;padding:0;opacity:0;pointer-events:none}\
#gdNav.mini .gdn-item.on{min-width:60px}\
#gdNav.mini .gdn-item.on span{opacity:0;max-height:0}\
#gdNav.mini .gdn-item.on{gap:0}\
.gdn-log{width:56px;height:56px;border-radius:50%;border:0;flex:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#06121a;\
 background:linear-gradient(145deg,#5eead4,#7c8cff);\
 box-shadow:0 16px 30px -12px rgba(94,234,212,.55),0 1px 0 rgba(255,255,255,.55) inset;\
 transition:transform .3s cubic-bezier(.32,1.6,.5,1),box-shadow .2s}\
.gdn-log svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;transition:transform .35s cubic-bezier(.32,1.6,.5,1)}\
.gdn-log:hover svg{transform:rotate(90deg)}\
.gdn-log:active{transform:scale(.9)}\
\
#gdNavScrim{position:fixed;inset:0;z-index:9100;background:rgba(2,4,8,.5);opacity:0;pointer-events:none;transition:opacity .3s ease}\
#gdNavScrim.show{opacity:1;pointer-events:auto}\
#gdNavSheet{position:fixed;left:50%;bottom:0;z-index:9101;width:min(560px,calc(100vw - 24px));max-height:78vh;display:flex;flex-direction:column;\
 transform:translate(-50%,105%);transition:transform .5s cubic-bezier(.32,1.1,.5,1);\
 margin-bottom:calc(12px + env(safe-area-inset-bottom,0px));border-radius:30px;overflow:hidden;\
 background:linear-gradient(180deg,#171c24,#0e1218);border:1px solid rgba(255,255,255,.1);\
 box-shadow:0 -10px 60px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.07) inset;color:#e8edf3}\
#gdNavSheet.show{transform:translate(-50%,0)}\
#gdNavSheet.drag{transition:none}\
.gdn-grab{flex:none;display:flex;justify-content:center;padding:10px 0 6px;cursor:grab;touch-action:none}\
.gdn-grab i{width:40px;height:5px;border-radius:3px;background:rgba(255,255,255,.22)}\
.gdn-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 20px 10px}\
.gdn-head h3{margin:0;font-size:19px;font-weight:700;letter-spacing:-.01em}\
.gdn-head button{border:0;background:rgba(255,255,255,.09);color:rgba(255,255,255,.75);width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;transition:transform .25s cubic-bezier(.32,1.6,.5,1),background .2s}\
.gdn-head button:hover{background:rgba(255,255,255,.16);color:#fff}\
.gdn-head button:active{transform:scale(.88)}\
.gdn-body{overflow:auto;padding:0 14px 18px;overscroll-behavior:contain}\
.gdn-sec{margin:14px 0 0}\
.gdn-sec h4{margin:0 0 7px 8px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.42)}\
.gdn-list{border-radius:18px;overflow:hidden;background:rgba(255,255,255,.055)}\
.gdn-row{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:0;background:transparent;color:inherit;font:500 14px/1.2 inherit;text-align:left;cursor:pointer;position:relative;transition:background .15s}\
.gdn-row+.gdn-row::before{content:"";position:absolute;top:0;left:56px;right:0;height:1px;background:rgba(255,255,255,.07)}\
.gdn-row:hover{background:rgba(255,255,255,.07)}\
.gdn-row:active{background:rgba(255,255,255,.13)}\
.gdn-ico{flex:none;width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#cfe;background:rgba(255,255,255,.08)}\
.gdn-ico svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\
.gdn-row.on .gdn-ico{background:rgba(94,234,212,.18);color:#5eead4}\
.gdn-row.on{color:#5eead4}\
.gdn-row .gdn-lbl{flex:1}\
.gdn-tag{font-size:9px;font-weight:700;letter-spacing:.08em;color:#f5a623;border:1px solid rgba(245,166,35,.4);border-radius:6px;padding:2px 6px}\
.gdn-chev{width:14px;height:14px;fill:none;stroke:rgba(255,255,255,.28);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\
\
html[data-theme="light"] #gdNavBar{background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(240,243,247,.96));border-color:rgba(0,0,0,.1);box-shadow:0 20px 40px -20px rgba(20,30,50,.35),0 1px 0 #fff inset}\
html[data-theme="light"] .gdn-item{color:rgba(20,28,40,.55)}\
html[data-theme="light"] .gdn-item:hover{color:#0b1220}\
html[data-theme="light"] .gdn-item.on{color:#0f766e}\
html[data-theme="light"] #gdNavLens{background:rgba(15,118,110,.12);box-shadow:none}\
html[data-theme="light"] #gdNavSheet{background:#f6f8fb;color:#0b1220;border-color:rgba(0,0,0,.08)}\
html[data-theme="light"] .gdn-list{background:#fff}\
html[data-theme="light"] .gdn-row+.gdn-row::before{background:rgba(0,0,0,.07)}\
html[data-theme="light"] .gdn-ico{background:rgba(0,0,0,.06);color:#334}\
html[data-theme="light"] .gdn-sec h4{color:rgba(0,0,0,.45)}\
html[data-theme="light"] .gdn-head button{background:rgba(0,0,0,.07);color:#333}\
@media (prefers-reduced-motion:reduce){#gdNav,#gdNavLens,.gdn-item,.gdn-item svg,#gdNavSheet,#gdNavScrim,.gdn-log,.gdn-log svg{transition:none!important}}';

  /* ---------- helpers that read the existing sidebar ---------- */
  function src(key){
    if(key==='scifeNavBtn'||key==='getAppBtn'||key==='signoutNavBtn') return document.getElementById(key);
    return document.querySelector('.side-navbtn[data-view="'+key+'"]');
  }
  function iconOf(key){
    var b = src(key), s = b && b.querySelector('svg');
    return s ? s.outerHTML : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>';
  }
  function labelOf(b){
    var c = b.cloneNode(true);
    c.querySelectorAll('svg,.lock-badge').forEach(function(n){ n.remove(); });
    return c.textContent.replace(/\s+/g,' ').trim();
  }
  function tagOf(b){ var t = b.querySelector('.lock-badge'); return t ? t.textContent.replace(/[^\w]/g,'').trim() || 'PRO' : ''; }
  function activeView(){ var a = document.querySelector('.side-navbtn.active'); return a ? a.dataset.view : 'dashboard'; }
  function go(key){ var b = src(key); if(b) b.click(); closeSheet(); }

  /* ---------- build ---------- */
  function build(){
    if(built) return; built = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    nav = document.createElement('div'); nav.id = 'gdNav';
    bar = document.createElement('nav'); bar.id = 'gdNavBar'; bar.setAttribute('aria-label','Quick navigation');
    lens = document.createElement('div'); lens.id = 'gdNavLens'; lens.className = 'none';
    var html = TABS.map(function(t){
      return '<button type="button" class="gdn-item" data-v="'+t[0]+'" aria-label="'+t[1]+'">'+iconOf(t[0])+'<span>'+t[1]+'</span></button>';
    }).join('');
    html += '<button type="button" class="gdn-item" data-more="1" aria-label="More pages" aria-haspopup="dialog">'+MORE_ICON+'<span>More</span></button>';
    bar.innerHTML = html; bar.insertBefore(lens, bar.firstChild);
    nav.appendChild(bar);

    var log = document.createElement('button');
    log.type = 'button'; log.className = 'gdn-log'; log.setAttribute('aria-label','Log a trade'); log.title = 'Log a trade';
    log.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    nav.appendChild(log);
    document.body.appendChild(nav);

    scrim = document.createElement('div'); scrim.id = 'gdNavScrim'; document.body.appendChild(scrim);
    sheet = document.createElement('div'); sheet.id = 'gdNavSheet'; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-label','All pages');
    document.body.appendChild(sheet);

    bar.addEventListener('click', function(e){
      var b = e.target.closest('.gdn-item'); if(!b) return;
      if(mini && !b.classList.contains('on')) return;
      if(mini){ setMini(false); return; }
      if(b.dataset.v) go(b.dataset.v); else toggleSheet();
    });
    bar.addEventListener('keydown', function(e){
      if(e.key!=='ArrowRight' && e.key!=='ArrowLeft') return;
      var items = Array.prototype.slice.call(bar.querySelectorAll('.gdn-item')), i = items.indexOf(document.activeElement);
      if(i<0) return; e.preventDefault();
      items[(i + (e.key==='ArrowRight'?1:items.length-1)) % items.length].focus();
    });
    bar.addEventListener('pointerenter', function(){ if(mini) setMini(false); });
    log.addEventListener('click', function(){ closeSheet(); if(typeof openPretrade==='function') openPretrade(); });

    scrim.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeSheet(); }, true);

    /* shrink on scroll down, grow on scroll up (iOS tab bar behaviour) */
    var lastY = {}, ticking = false;
    document.addEventListener('scroll', function(e){
      var t = e.target === document ? (document.scrollingElement || document.documentElement) : e.target;
      if(!t || (t.closest && t.closest('#gdNavSheet'))) return;
      var y = t.scrollTop || 0, prev = lastY[t.id||t.className||'doc'] || 0;
      lastY[t.id||t.className||'doc'] = y;
      if(ticking) return; ticking = true;
      requestAnimationFrame(function(){
        ticking = false;
        var d = y - prev;
        if(Math.abs(d) < 8) return;
        if(d > 0 && y > 120) setMini(true); else if(d < 0) setMini(false);
      });
    }, true);

    var shell = document.getElementById('appShell');
    if(shell) new MutationObserver(apply).observe(shell, { attributes:true, attributeFilter:['class'] });
    var side = document.getElementById('sideNav') || document.querySelector('.sidebar');
    if(side){
      var mo = new MutationObserver(function(){ sync(); });
      side.querySelectorAll('.side-navbtn').forEach(function(b){ mo.observe(b, { attributes:true, attributeFilter:['class'] }); });
    }
    window.addEventListener('resize', function(){ apply(); placeLens(); });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(placeLens);
  }

  /* ---------- sliding lens ---------- */
  function placeLens(){
    if(!bar || !lens) return;
    var on = bar.querySelector('.gdn-item.on');
    if(!on){ lens.classList.add('none'); return; }
    lens.classList.remove('none');
    lens.style.width = on.offsetWidth + 'px';
    lens.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  function trackLens(){ /* follow the item while its width animates in mini mode */
    cancelAnimationFrame(lensRaf);
    var end = performance.now() + 520;
    (function tick(){ placeLens(); if(performance.now() < end) lensRaf = requestAnimationFrame(tick); })();
  }
  function setMini(v){ if(!nav || v===mini) return; mini = v; nav.classList.toggle('mini', v); trackLens(); }

  function sync(){
    if(!bar) return;
    var v = activeView(), inTabs = TABS.some(function(t){ return t[0]===v; });
    bar.querySelectorAll('.gdn-item[data-v]').forEach(function(b){
      b.classList.toggle('on', b.dataset.v === v);
      var sb = src(b.dataset.v); b.classList.toggle('locked', !!(sb && sb.querySelector('.lock-badge')));
    });
    var more = bar.querySelector('[data-more]'); if(more) more.classList.toggle('on', !inTabs);
    if(REDUCED.matches) placeLens(); else trackLens();
  }

  /* ---------- sheet ---------- */
  function buildSheet(){
    var v = activeView(), seen = {}, out = '';
    GROUPS.forEach(function(g){
      var rows = '';
      g[1].forEach(function(key){
        var b = src(key); if(!b || seen[key]) return; seen[key] = 1;
        var tag = tagOf(b);
        rows += '<button type="button" class="gdn-row'+(key===v?' on':'')+'" data-v="'+key+'"><span class="gdn-ico">'+iconOf(key)+'</span><span class="gdn-lbl">'+labelOf(b)+'</span>'+(tag?'<span class="gdn-tag">'+tag+'</span>':'')+'<svg class="gdn-chev" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg></button>';
      });
      if(rows) out += '<section class="gdn-sec"><h4>'+g[0]+'</h4><div class="gdn-list">'+rows+'</div></section>';
    });
    sheet.innerHTML = '<div class="gdn-grab" aria-hidden="true"><i></i></div><div class="gdn-head"><h3>All pages</h3><button type="button" data-close="1" aria-label="Close">✕</button></div><div class="gdn-body">'+out+'</div>';
    sheet.onclick = function(e){
      if(e.target.closest('[data-close]')) return closeSheet();
      var r = e.target.closest('.gdn-row'); if(r) go(r.dataset.v);
    };
    var grab = sheet.querySelector('.gdn-grab'), head = sheet.querySelector('.gdn-head'), drag = null;
    function down(e){ if(e.target.closest('button')) return; drag = { y:e.clientY, dy:0 }; sheet.classList.add('drag'); (e.currentTarget).setPointerCapture(e.pointerId); }
    function move(e){ if(!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); sheet.style.transform = 'translate(-50%,'+drag.dy+'px)'; scrim.style.opacity = String(Math.max(0, 1 - drag.dy/360)); }
    function up(){ if(!drag) return; var d = drag.dy; drag = null; sheet.classList.remove('drag'); sheet.style.transform = ''; scrim.style.opacity = ''; if(d > 110) closeSheet(); }
    [grab, head].forEach(function(h){ h.addEventListener('pointerdown', down); h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); });
  }
  function toggleSheet(){ if(sheet.classList.contains('show')) closeSheet(); else openSheet(); }
  function openSheet(){ buildSheet(); scrim.classList.add('show'); sheet.classList.add('show'); var f = sheet.querySelector('.gdn-row.on, .gdn-row'); if(f) setTimeout(function(){ f.focus({ preventScroll:true }); }, 260); }
  function closeSheet(){ if(!sheet) return; var was = sheet.classList.contains('show'); sheet.classList.remove('show'); scrim.classList.remove('show'); if(was){ var m = bar && bar.querySelector('[data-more]'); if(m && sheet.contains(document.activeElement)) m.focus({ preventScroll:true }); } }

  /* ---------- show / hide ---------- */
  function apply(){
    var shell = document.getElementById('appShell');
    var visible = MQ.matches && (!shell || shell.classList.contains('show'));
    if(!visible){ if(built){ nav.classList.add('off'); closeSheet(); } return; }
    build(); nav.classList.remove('off'); sync();
  }

  function init(){
    /* retire the old macOS-style dock if a cached copy is still around */
    ['gdDock','gdOrb','gdSheet'].forEach(function(id){ var n = document.getElementById(id); if(n) n.remove(); });
    apply(); if(MQ.addEventListener) MQ.addEventListener('change', apply);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
