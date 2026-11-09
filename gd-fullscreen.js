/* Ghost Discipline - desktop full screen for the installed web app.
   - First click/keypress inside the installed desktop app enters full screen.
   - Esc leaves full screen; Esc again returns to full screen.
   Browsers only allow full screen from a user gesture, and Esc is not counted as one, so if the
   browser refuses the Esc re-entry a small prompt appears and the next click/key restores it. */
(function(){
  'use strict';
  var desktop = window.matchMedia('(pointer:fine)').matches && window.innerWidth >= 900;
  var installed = ['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(function(m){ return window.matchMedia('(display-mode: '+m+')').matches; });
  if(!desktop || !installed || !document.documentElement.requestFullscreen) return;

  var root = document.documentElement, pill = null, wantBack = false, entered = false;
  function isFull(){ return !!document.fullscreenElement; }
  function modalOpen(){ return !!document.querySelector('.overlay.show, dialog[open]'); }

  function lockEsc(){
    try{ if(navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(function(){}); }catch(e){}
  }
  function unlockEsc(){ try{ if(navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); }catch(e){} }

  function showPill(){
    if(pill) return;
    pill = document.createElement('button');
    pill.type = 'button';
    pill.textContent = 'Press Esc or click to return to full screen';
    pill.setAttribute('style','position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;padding:9px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(10,13,16,.92);color:#e8eaed;font:600 12px "IBM Plex Mono",monospace;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45)');
    pill.addEventListener('click', function(e){ e.stopPropagation(); goFull(); });
    document.body.appendChild(pill);
  }
  function hidePill(){ if(pill){ pill.remove(); pill = null; } }

  function goFull(){
    if(isFull()) return Promise.resolve();
    return root.requestFullscreen({ navigationUI:'hide' }).then(function(){ wantBack = false; hidePill(); }).catch(function(){ if(wantBack) showPill(); });
  }
  function leaveFull(){
    wantBack = true;
    var p = isFull() ? document.exitFullscreen() : Promise.resolve();
    Promise.resolve(p).catch(function(){}).then(showPill);
  }

  document.addEventListener('fullscreenchange', function(){
    if(isFull()){ lockEsc(); hidePill(); wantBack = false; }
    else { unlockEsc(); if(entered){ wantBack = true; showPill(); } }
  });

  // Esc while in full screen (works where Keyboard Lock is available, i.e. Chrome/Edge).
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape' || e.repeat) return;
    if(isFull()){
      if(modalOpen()) return;          // let the app close its dialog first
      e.preventDefault(); leaveFull();
    } else if(wantBack){
      e.preventDefault(); goFull();    // second Esc: back to full screen
    }
  }, true);
  // Browsers that swallow Esc keydown on exit still deliver keyup.
  document.addEventListener('keyup', function(e){
    if(e.key === 'Escape' && !isFull() && entered){ wantBack = true; goFull(); }
  }, true);

  // First gesture of the session enters full screen; any later gesture restores it if Esc left it.
  function gesture(e){
    if(e.type === 'keydown' && e.key === 'Escape') return;
    if(!entered){ entered = true; goFull(); return; }
    if(wantBack && !isFull()) goFull();
  }
  ['pointerdown','keydown'].forEach(function(t){ document.addEventListener(t, gesture, true); });
})();
