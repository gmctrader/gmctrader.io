/* Ghost Discipline - floating iOS-style dock for desktop.
   - Frosted-glass pill, centred at the bottom, with hover magnification like the macOS/iOS dock.
   - Buttons drive the existing sidebar buttons, so tier locks, demo locks and renders all still apply.
   - "More" opens a glass sheet with every page. The dock can shrink into a draggable orb
     (like iOS AssistiveTouch); its position is remembered. */
(function(){
  'use strict';
  var MQ = window.matchMedia('(min-width:961px) and (pointer:fine)');
  var PRIMARY = [
    ['dashboard','Overview'], ['journal','Journal'], ['analytics','Analytics'],
    ['orders','Orders'], ['rulebreaks','Rule Breaks'], ['propfirm','Prop']
  ];
  var KEY = 'gd_dock_v1', dock, orb, sheet, built = false;
  var pref = (function(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } })();
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(pref)); }catch(e){} }

  var css = '\
#gdDock,#gdOrb,#gdSheet{font-family:"IBM Plex Mono",ui-monospace,monospace}\
#gdDock{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9000;display:flex;align-items:flex-end;gap:6px;padding:8px 10px;border-radius:26px;\
 background:rgba(22,26,32,.55);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(26px) saturate(1.6);-webkit-backdrop-filter:blur(26px) saturate(1.6);\
 box-shadow:0 18px 50px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12);transition:opacity .25s,transform .3s cubic-bezier(.2,.9,.3,1.2)}\
#gdDock.hide{opacity:0;pointer-events:none;transform:translate(-50%,30px) scale(.9)}\
.gdd-btn{position:relative;width:46px;height:46px;border-radius:14px;border:0;background:rgba(255,255,255,.06);color:#cfd5dc;display:flex;align-items:center;justify-content:center;cursor:pointer;\
 transform-origin:50% 100%;transition:transform .16s cubic-bezier(.3,.8,.4,1),background .2s,color .2s}\
.gdd-btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\
.gdd-btn:hover{background:rgba(255,255,255,.12);color:#fff}\
.gdd-btn.on{color:#5eead4;background:rgba(94,234,212,.14)}\
.gdd-btn.on::after{content:"";position:absolute;bottom:-5px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#5eead4}\
.gdd-btn.locked{opacity:.6}\
.gdd-btn[data-tip]:hover::before{content:attr(data-tip);position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:5px 10px;border-radius:9px;\
 background:rgba(12,15,19,.92);border:1px solid rgba(255,255,255,.12);color:#e8eaed;font-size:11px;pointer-events:none}\
.gdd-sep{width:1px;align-self:stretch;margin:6px 3px;background:rgba(255,255,255,.12)}\
.gdd-cta{background:linear-gradient(135deg,#2dd4bf,#60a5fa);color:#06121a}\
.gdd-cta:hover{background:linear-gradient(135deg,#5eead4,#93c5fd);color:#06121a}\
#gdOrb{position:fixed;z-index:9000;width:56px;height:56px;border-radius:50%;display:none;align-items:center;justify-content:center;cursor:grab;touch-action:none;\
 background:rgba(22,26,32,.6);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);\
 box-shadow:0 12px 34px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.14);color:#e8eaed;user-select:none}\
#gdOrb i{width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.5),rgba(255,255,255,.12));display:block;box-shadow:inset 0 0 0 5px rgba(255,255,255,.16)}\
#gdOrb.drag{cursor:grabbing}\
#gdSheet{position:fixed;left:50%;bottom:92px;transform:translateX(-50%) scale(.96);z-index:9001;width:min(640px,92vw);max-height:60vh;overflow:auto;padding:14px;border-radius:24px;opacity:0;pointer-events:none;\
 background:rgba(18,22,27,.72);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(30px) saturate(1.6);-webkit-backdrop-filter:blur(30px) saturate(1.6);box-shadow:0 24px 70px rgba(0,0,0,.55);\
 transition:opacity .2s,transform .25s cubic-bezier(.2,.9,.3,1.2)}\
#gdSheet.show{opacity:1;pointer-events:auto;transform:translateX(-50%) scale(1)}\
.gds-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}\
.gds-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:16px;border:0;background:rgba(255,255,255,.05);color:#d7dce2;cursor:pointer;font:500 11px "IBM Plex Mono",monospace;position:relative;text-align:center}\
.gds-item:hover{background:rgba(255,255,255,.11);color:#fff}\
.gds-item.on{color:#5eead4;background:rgba(94,234,212,.13)}\
.gds-item svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\
.gds-tag{position:absolute;top:6px;right:8px;font-size:8px;letter-spacing:.08em;color:#f5a623}\
.gds-bar{display:flex;justify-content:flex-end;margin-bottom:8px}\
.gds-bar button{border:0;background:transparent;color:#8b93a0;font:600 11px "IBM Plex Mono",monospace;cursor:pointer}\
@media (prefers-reduced-motion:reduce){#gdDock,.gdd-btn,#gdSheet{transition:none}}';

  function sideBtn(v){ return document.querySelector('.side-navbtn[data-view="'+v+'"]'); }
  function iconOf(v){
    var b = sideBtn(v), s = b && b.querySelector('svg');
    return s ? s.outerHTML : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
  }
  function labelOf(b){ var c = b.cloneNode(true); c.querySelectorAll('svg,.lock-badge').forEach(function(n){ n.remove(); }); return c.textContent.replace(/\s+/g,' ').trim(); }
  function go(v){ var b = sideBtn(v); if(b) b.click(); closeSheet(); }
  function activeView(){ var a = document.querySelector('.side-navbtn.active'); return a ? a.dataset.view : 'dashboard'; }

  function build(){
    if(built) return; built = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    dock = document.createElement('nav'); dock.id = 'gdDock'; dock.setAttribute('aria-label','Quick navigation');
    var html = PRIMARY.map(function(p){
      return '<button class="gdd-btn" data-v="'+p[0]+'" data-tip="'+p[1]+'" aria-label="'+p[1]+'">'+iconOf(p[0])+'</button>';
    }).join('');
    html += '<button class="gdd-btn" data-more="1" data-tip="All pages" aria-label="All pages"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>';
    html += '<span class="gdd-sep"></span>';
    html += '<button class="gdd-btn gdd-cta" data-log="1" data-tip="Log a trade" aria-label="Log a trade"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>';
    html += '<button class="gdd-btn" data-collapse="1" data-tip="Minimise" aria-label="Minimise dock"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>';
    dock.innerHTML = html;
    document.body.appendChild(dock);

    orb = document.createElement('div'); orb.id = 'gdOrb'; orb.setAttribute('role','button'); orb.setAttribute('aria-label','Open navigation'); orb.tabIndex = 0; orb.innerHTML = '<i></i>';
    document.body.appendChild(orb);

    sheet = document.createElement('div'); sheet.id = 'gdSheet'; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-label','All pages');
    document.body.appendChild(sheet);

    dock.addEventListener('click', function(e){
      var b = e.target.closest('.gdd-btn'); if(!b) return;
      if(b.dataset.v) go(b.dataset.v);
      else if(b.dataset.more) toggleSheet();
      else if(b.dataset.log){ closeSheet(); if(typeof openPretrade==='function') openPretrade(); }
      else if(b.dataset.collapse){ pref.collapsed = true; save(); closeSheet(); apply(); }
    });
    // macOS-style magnification
    dock.addEventListener('mousemove', function(e){
      dock.querySelectorAll('.gdd-btn').forEach(function(b){
        var r = b.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width/2));
        var s = Math.max(1, 1.45 - d/110); b.style.transform = 'scale('+s.toFixed(3)+') translateY('+(-(s-1)*8).toFixed(1)+'px)';
      });
    });
    dock.addEventListener('mouseleave', function(){ dock.querySelectorAll('.gdd-btn').forEach(function(b){ b.style.transform=''; }); });

    // draggable orb
    var drag = null;
    orb.addEventListener('pointerdown', function(e){
      drag = { x:e.clientX, y:e.clientY, l:orb.offsetLeft, t:orb.offsetTop, moved:false };
      orb.setPointerCapture(e.pointerId);
    });
    orb.addEventListener('pointermove', function(e){
      if(!drag) return;
      var dx = e.clientX-drag.x, dy = e.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy) > 4){ drag.moved = true; orb.classList.add('drag'); }
      if(drag.moved){
        var l = Math.min(innerWidth-60, Math.max(4, drag.l+dx)), t = Math.min(innerHeight-60, Math.max(4, drag.t+dy));
        orb.style.left = l+'px'; orb.style.top = t+'px';
      }
    });
    orb.addEventListener('pointerup', function(){
      if(!drag) return; var moved = drag.moved; drag = null; orb.classList.remove('drag');
      if(moved){ pref.x = orb.offsetLeft; pref.y = orb.offsetTop; save(); }
      else { pref.collapsed = false; save(); apply(); }
    });
    orb.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ pref.collapsed=false; save(); apply(); } });

    document.addEventListener('pointerdown', function(e){ if(sheet.classList.contains('show') && !sheet.contains(e.target) && !dock.contains(e.target)) closeSheet(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeSheet(); }, true);

    var sidebar = document.querySelector('.sidebar');
    var mo = new MutationObserver(function(){ syncActive(); });
    document.querySelectorAll('.side-navbtn').forEach(function(b){ mo.observe(b, { attributes:true, attributeFilter:['class'] }); });
    var shell = document.getElementById('appShell');
    if(shell) new MutationObserver(apply).observe(shell, { attributes:true, attributeFilter:['class'] });
    new MutationObserver(function(){ syncActive(); }).observe(document.body, { childList:false, attributes:true, attributeFilter:['class'] });
    window.addEventListener('resize', apply);
  }

  function syncActive(){
    if(!dock) return;
    var v = activeView();
    dock.querySelectorAll('.gdd-btn[data-v]').forEach(function(b){
      b.classList.toggle('on', b.dataset.v === v);
      var sb = sideBtn(b.dataset.v); b.classList.toggle('locked', !!(sb && sb.querySelector('.lock-badge')));
    });
    var more = dock.querySelector('[data-more]');
    if(more) more.classList.toggle('on', !PRIMARY.some(function(p){ return p[0]===v; }));
  }

  function buildSheet(){
    var v = activeView(), items = [];
    document.querySelectorAll('.side-navbtn[data-view]').forEach(function(b){
      var tag = b.querySelector('.lock-badge');
      items.push('<button class="gds-item'+(b.dataset.view===v?' on':'')+'" data-v="'+b.dataset.view+'">'+(tag?'<span class="gds-tag">'+tag.textContent.trim()+'</span>':'')+iconOf(b.dataset.view)+'<span>'+labelOf(b)+'</span></button>');
    });
    sheet.innerHTML = '<div class="gds-bar"><button type="button" data-close="1">Close ✕</button></div><div class="gds-grid">'+items.join('')+'</div>';
    sheet.onclick = function(e){
      if(e.target.closest('[data-close]')) return closeSheet();
      var it = e.target.closest('.gds-item'); if(it) go(it.dataset.v);
    };
  }
  function toggleSheet(){ if(sheet.classList.contains('show')) closeSheet(); else { buildSheet(); sheet.classList.add('show'); } }
  function closeSheet(){ if(sheet) sheet.classList.remove('show'); }

  function apply(){
    var shell = document.getElementById('appShell');
    var visible = MQ.matches && (!shell || shell.classList.contains('show'));
    if(!visible){ if(built){ dock.classList.add('hide'); orb.style.display='none'; closeSheet(); } return; }
    build();
    syncActive();
    if(pref.collapsed){
      dock.classList.add('hide'); orb.style.display = 'flex';
      var x = pref.x != null ? Math.min(pref.x, innerWidth-60) : innerWidth/2-28;
      var y = pref.y != null ? Math.min(pref.y, innerHeight-60) : innerHeight-84;
      orb.style.left = x+'px'; orb.style.top = y+'px';
    } else { dock.classList.remove('hide'); orb.style.display = 'none'; }
  }

  function init(){ apply(); if(MQ.addEventListener) MQ.addEventListener('change', apply); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
