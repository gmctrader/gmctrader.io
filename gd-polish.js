/* Ghost Discipline — Polish layer: Apple-style frosted top navigation + one consistent button system.
   Pure CSS plus a tiny scroll hook. Uses the app's own theme variables, so Portal Studio accents still apply. */
(() => {
  const st = document.createElement('style');
  st.id = 'gdPolish';
  st.textContent = `
/* ---------- Buttons: one system ---------- */
#appShell :is(.btn,.btn-gold,.btn-telegram,.first-session-get-app,.ai-refresh-btn){display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 20px;border-radius:12px;font-weight:600;font-size:13px;line-height:1;letter-spacing:.01em;text-decoration:none;white-space:nowrap;-webkit-tap-highlight-color:transparent;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .2s,background-color .2s,border-color .2s,color .2s,filter .2s}
#appShell .btn svg,#appShell .btn-gold svg{width:15px;height:15px;flex:none}
#appShell .btn-sm{min-height:34px;padding:0 14px;font-size:12px;border-radius:10px}
#appShell .btn-block,#appShell .btn-gold{width:100%}
#appShell :is(.btn-primary,.btn-gold){background:linear-gradient(180deg,color-mix(in srgb,var(--bronze-bright) 92%,#fff),var(--bronze));color:var(--bronze-ink);border:1px solid color-mix(in srgb,var(--bronze-bright) 70%,#000);box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 8px 22px -10px color-mix(in srgb,var(--bronze-bright) 60%,transparent)}
#appShell :is(.btn-primary,.btn-gold):hover{transform:translateY(-1px);filter:brightness(1.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.42),0 12px 28px -10px color-mix(in srgb,var(--bronze-bright) 70%,transparent)}
#appShell :is(.btn,.btn-gold):active{transform:translateY(0) scale(.975);filter:brightness(.96);transition-duration:.06s}
#appShell .btn-ghost,#appShell .btn-secondary{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.14);color:var(--platinum);box-shadow:none}
#appShell :is(.btn-ghost,.btn-secondary):hover{background:rgba(255,255,255,.075);border-color:color-mix(in srgb,var(--bronze-bright) 55%,transparent);transform:translateY(-1px)}
#appShell :is(.btn,.btn-gold):is(:disabled,[aria-disabled=true]){opacity:.45;cursor:not-allowed;transform:none;filter:none;box-shadow:none}
#appShell :is(.btn,.btn-gold,.overview-filter-trigger,.card-expand-btn,.ai-refresh-btn,.ai-chip,.first-session-get-app,.tab-btn):focus-visible{outline:2px solid var(--bronze-bright)!important;outline-offset:3px;box-shadow:0 0 0 5px color-mix(in srgb,var(--bronze-bright) 16%,transparent)!important}
/* dashboard controls */
#appShell :is(.overview-filter-trigger,.ai-chip){display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:var(--platinum);font-weight:600;font-size:12px;cursor:pointer;transition:background-color .2s,border-color .2s,transform .18s,box-shadow .2s}
#appShell :is(.overview-filter-trigger,.ai-chip):hover{background:rgba(255,255,255,.08);border-color:color-mix(in srgb,var(--bronze-bright) 55%,transparent);transform:translateY(-1px)}
#appShell :is(.overview-filter-trigger,.ai-chip):active{transform:scale(.97)}
#appShell .card-expand-btn{border-radius:10px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);cursor:pointer;transition:background-color .2s,border-color .2s,transform .18s,color .2s}
#appShell .card-expand-btn:hover{background:rgba(255,255,255,.09);border-color:color-mix(in srgb,var(--bronze-bright) 55%,transparent);color:var(--bronze-bright);transform:scale(1.06)}
#appShell .card-expand-btn:active{transform:scale(.94)}
#appShell .ai-refresh-btn{min-height:36px;padding:0 14px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:var(--platinum);font-size:12px;cursor:pointer}
#appShell .ai-refresh-btn:hover{background:rgba(255,255,255,.08);border-color:color-mix(in srgb,var(--bronze-bright) 55%,transparent);transform:translateY(-1px)}
@media(max-width:600px){#appShell :is(.btn,.btn-gold){min-height:44px}}
/* ---------- Apple-style top navigation (desktop): flush, full-width, frosted ---------- */
@media(min-width:961px){
  html:not(#x) .desktop-nav{inset:0 0 auto 0;left:0;width:100%;height:52px;transform:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px;padding:0 clamp(20px,3vw,48px);border:0;border-bottom:1px solid rgba(255,255,255,.08);border-radius:0;background:rgba(14,14,16,.72)!important;-webkit-backdrop-filter:saturate(180%) blur(24px);backdrop-filter:saturate(180%) blur(24px);box-shadow:none;transition:background-color .3s,box-shadow .3s}
  html:not(#x) .desktop-nav::before{display:none}
  html:not(#x) .desktop-nav.gdn-scrolled{background:rgba(8,8,10,.9)!important;box-shadow:0 16px 40px -24px #000}
  html:not(#x) #appShell.show>.main{margin-top:52px;min-height:calc(100vh - 52px);min-height:calc(100dvh - 52px);padding-top:30px}
  html:not(#x) .desktop-nav-brand{justify-self:start;font-size:13.5px;transition:opacity .2s}html:not(#x) .desktop-nav-brand:hover{opacity:.78}html:not(#x) .desktop-nav-brand img{width:26px;height:26px;border-radius:7px}
  html:not(#x) .desktop-nav-links{justify-self:center;align-items:center;gap:0;min-width:0}
  html:not(#x) .desktop-nav-meta{justify-self:end;margin:0;padding-right:124px;opacity:.7}
  html:not(#x) :is(.desktop-nav-link,.desktop-nav-trigger){position:relative;min-height:34px;padding:0 13px;border:0;border-radius:8px;background:none;box-shadow:none;color:rgba(245,245,247,.68);font:400 12.5px/1 'Instrument Sans',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;letter-spacing:-.005em;transition:color .2s,background-color .2s}
  html:not(#x) .desktop-nav-links>.desktop-nav-link:not(.gdn-pipx) svg{display:none}
  html:not(#x) :is(.desktop-nav-link,.desktop-nav-trigger):hover,html:not(#x) .desktop-nav-group.open>.desktop-nav-trigger{background:none;color:#fff;transform:none}
  html:not(#x) :is(.desktop-nav-link.active,.desktop-nav-group.has-active>.desktop-nav-trigger){background:none;border:0;box-shadow:none;color:#fff}
  html:not(#x) .desktop-nav-links>.desktop-nav-link.active::after,html:not(#x) .desktop-nav-group.has-active>.desktop-nav-trigger::after{content:'';position:absolute;left:50%;bottom:1px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--bronze-bright);box-shadow:0 0 10px var(--bronze-bright)}
  html:not(#x) .desktop-nav-trigger svg{width:10px;height:10px;opacity:.7}
  html:not(#x) .desktop-nav-menu{top:calc(100% + 10px);left:50%;min-width:236px;padding:8px;gap:2px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(24,24,26,.82)!important;-webkit-backdrop-filter:saturate(180%) blur(30px);backdrop-filter:saturate(180%) blur(30px);box-shadow:0 28px 70px -24px #000;transform:translateX(-50%) translateY(-6px) scale(.97);transform-origin:50% 0;transition:opacity .18s ease,transform .22s cubic-bezier(.2,.8,.2,1),visibility .18s}
  html:not(#x) .desktop-nav-menu::before{content:'';position:absolute;left:0;right:0;top:-12px;height:12px}
  html:not(#x) .desktop-nav-group:hover>.desktop-nav-menu,html:not(#x) .desktop-nav-group:focus-within>.desktop-nav-menu,html:not(#x) .desktop-nav-group.open>.desktop-nav-menu{transform:translateX(-50%) translateY(0) scale(1)}
  html:not(#x) .desktop-nav-menu .desktop-nav-link{justify-content:flex-start;gap:11px;min-height:38px;padding:0 12px;border-radius:10px;color:rgba(245,245,247,.82);font-size:13px}
  html:not(#x) .desktop-nav-menu .desktop-nav-link svg{display:block;width:16px;height:16px;flex:0 0 16px;opacity:.75}
  html:not(#x) .desktop-nav-menu .desktop-nav-link:hover{background:rgba(255,255,255,.075)}
  html:not(#x) .desktop-nav-menu .desktop-nav-link.active{background:color-mix(in srgb,var(--bronze-bright) 15%,transparent);color:#fff}
  html:not(#x) .gdn-pipx{gap:6px;color:var(--bronze-bright)!important}html:not(#x) .gdn-pipx svg{display:block;width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .gdn-tag{display:none;padding:2px 6px;border:1px solid color-mix(in srgb,var(--bronze-bright) 40%,transparent);border-radius:99px;font:normal 7.5px/1 'IBM Plex Mono',monospace;letter-spacing:.08em}.gdn-pipx.locked .gdn-tag{display:inline-block}
  #planBadge{top:10px;right:clamp(20px,3vw,48px);min-height:32px;border-radius:99px;z-index:110}
}
/* ---------- Pricing cards: every row lines up across all four plans ---------- */
@supports (grid-template-rows:subgrid){
  .package-grid{gap:0 13px}
  .package-card{display:grid;grid-template-rows:subgrid;grid-row:span 6;row-gap:0;margin-bottom:13px}
  .package-card>:last-child{align-self:end}
}
@supports not (grid-template-rows:subgrid){.package-price{min-height:72px}}
@media(prefers-reduced-motion:reduce){#appShell :is(.btn,.btn-gold,.overview-filter-trigger,.ai-chip,.card-expand-btn,.ai-refresh-btn),.desktop-nav-menu{transition:none!important}}`;
  document.head.appendChild(st);
  const hook = () => { const n = document.getElementById('desktopNav'); if (!n) return; const f = () => n.classList.toggle('gdn-scrolled', window.scrollY > 6); addEventListener('scroll', f, { passive: true }); f(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', hook) : hook();
  const PIPX = 'https://pipx-six.vercel.app/', prem = () => { try { return typeof isPremiumTier === 'function' && isPremiumTier(); } catch (e) { return false; } };
  const syncPipx = () => { const b = document.querySelector('.gdn-pipx'); if (!b) return; const p = prem(); b.classList.toggle('locked', !p); b.title = p ? 'Open PipX Ledger in a new tab' : 'Included with Premium. Tap to see how it works'; };
  const addPipx = () => {
    const r = document.getElementById('desktopNavLinks'); if (!r) return;
    if (!r.querySelector('.gdn-pipx')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'desktop-nav-link gdn-pipx';
      b.innerHTML = '<span>PipX News</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5"/></svg><em class="gdn-tag">PREMIUM</em>';
      b.addEventListener('click', () => { if (prem()) window.open(PIPX, '_blank', 'noopener'); else { const s = document.querySelector('.side-navbtn[data-view="addfeatures"]'); if (s) s.click(); } });
      r.appendChild(b);
    }
    syncPipx();
    if (typeof window.applyTierLocks === 'function' && !window.applyTierLocks.__gp) { const o = window.applyTierLocks; window.applyTierLocks = function () { const x = o.apply(this, arguments); try { syncPipx(); } catch (e) {} return x; }; window.applyTierLocks.__gp = true; }
  };
  const boot2 = () => { addPipx(); setTimeout(addPipx, 1500); setTimeout(addPipx, 4000); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot2) : boot2();
  addEventListener('load', addPipx);
})();
