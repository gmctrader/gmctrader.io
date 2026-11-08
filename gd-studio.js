/* Ghost Discipline — Portal Studio (Elite & Premium). Restyles the portal: theme, accent, font, cards, radius, density, glow.
   Saved per device; applied only while the account is Elite or higher. Client-side convenience, not a security boundary. */
(() => {
  const d = document, root = d.documentElement, $ = id => d.getElementById(id), KEY = 'gd_portal_look';
  const DEF = { preset: 'emerald', custom: '#10b981', font: 'default', card: 'glass', radius: 'soft', density: 'comfortable', glow: 'soft' };
  const PRE = { emerald: ['Emerald', '#2dd4a8', '#12b988', '#063b2c'], violet: ['Violet Nebula', '#c4b5fd', '#a78bfa', '#2e1f5e'], ocean: ['Ocean', '#67e8f9', '#22d3ee', '#083344'], gold: ['Gold Reserve', '#ffdf9e', '#f2c877', '#4a3a12'], rose: ['Rose Quartz', '#fda4af', '#fb7185', '#4c0f1e'], crimson: ['Crimson', '#fca5a5', '#ef4444', '#450a0a'], ice: ['Ice', '#e2e8f0', '#94a3b8', '#1e293b'] };
  const FONTS = { default: ['Default', ''], inter: ['Inter', 'Inter'], sora: ['Sora', 'Sora'], grotesk: ['Space Grotesk', 'Space Grotesk'], manrope: ['Manrope', 'Manrope'], plex: ['Plex Mono', 'IBM Plex Mono'] };
  const RAD = { sharp: '4px', soft: '14px', round: '26px' };
  const GLOW = { off: 0, soft: .14, vivid: .3 };
  const eliteNow = () => { try { if (typeof tierAtLeast === 'function') return tierAtLeast('elite'); return localStorage.getItem('gd_elite_ok') === '1'; } catch (e) { return false; } };
  const read = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { ...DEF }; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const mix = (h, t, a) => { const n = parseInt(h.slice(1), 16), c = i => Math.round(((n >> i) & 255) * (1 - a) + t * a); return '#' + [16, 8, 0].map(i => c(i).toString(16).padStart(2, '0')).join(''); };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
  const colors = s => s.preset === 'custom' ? [mix(s.custom, 255, .3), s.custom, mix(s.custom, 0, .82)] : PRE[s.preset].slice(1);

  const css = d.createElement('style');
  css.textContent = `html[data-gdl-card=solid] .card{background:#0b1210!important;backdrop-filter:none!important}
html[data-gdl-card=outline] .card{background:transparent!important;backdrop-filter:none!important;box-shadow:none!important;border:1px solid var(--bronze)!important}
html[data-gdl-r] .card,html[data-gdl-r] .btn{border-radius:var(--gdl-r)!important}
html[data-gdl-density=compact] .card{padding:14px 16px!important}html[data-gdl-density=spacious] .card{padding:30px 34px!important}
html[data-gdl-glow] #gdxBg::after{content:'';position:absolute;inset:0;background:radial-gradient(900px 520px at 12% -8%,rgba(var(--gdl-rgb),var(--gdl-glow)),transparent 62%),radial-gradient(700px 480px at 100% 100%,rgba(var(--gdl-rgb),calc(var(--gdl-glow)*.7)),transparent 62%)}
html[data-gdl-font] body,html[data-gdl-font] button,html[data-gdl-font] input,html[data-gdl-font] select,html[data-gdl-font] textarea{font-family:var(--gdl-font),sans-serif!important}
.gs{margin-bottom:var(--gs-gap,18px)}.gs-hero p{max-width:720px;color:var(--slate,#9fb0a8);line-height:1.7}.gs-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.gs-chips span{padding:6px 12px;border:1px solid var(--bronze-dim,#063b2c);border-radius:99px;font-size:12px;color:var(--bronze-bright)}
.gs-sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px;margin:12px 0}.gs-sw button{display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);font-size:12.5px;font-weight:600;color:inherit;cursor:pointer;transition:.2s}
.gs-sw button i{width:18px;height:18px;border-radius:50%;flex:none}.gs-sw button:hover{transform:translateY(-2px);border-color:var(--bronze)}.gs-sw button.on{border-color:var(--bronze-bright);box-shadow:0 0 0 1px var(--bronze-bright),0 0 22px -6px var(--bronze)}
.gs-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 0;border-top:1px solid rgba(255,255,255,.06)}.gs-row small{display:block;color:var(--slate,#8b9c95);font-size:11.5px}
.gs-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border:1px solid rgba(255,255,255,.1);border-radius:12px}.gs-seg button{padding:7px 13px;border:0;border-radius:9px;background:none;color:inherit;font-size:12.5px;font-weight:600;cursor:pointer}.gs-seg button.on{background:var(--bronze);color:var(--bronze-ink,#03110c)}
.gs-prev{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;padding:14px;border:1px dashed var(--bronze-dim);border-radius:14px}.gs-prev b{color:var(--bronze-bright)}`;
  d.head.appendChild(css);

  function apply() {
    const s = read(), on = eliteNow(), a = ['gdl-card', 'gdl-r', 'gdl-density', 'gdl-glow', 'gdl-font'].map(x => 'data-' + x);
    ['--bronze-bright', '--bronze', '--bronze-dim', '--gdl-r', '--gdl-rgb', '--gdl-glow', '--gdl-font'].forEach(p => root.style.removeProperty(p));
    a.forEach(x => root.removeAttribute(x));
    if (!on) return;
    const [br, ba, di] = colors(s);
    if (s.preset !== 'emerald') { root.style.setProperty('--bronze-bright', br); root.style.setProperty('--bronze', ba); root.style.setProperty('--bronze-dim', di); }
    root.style.setProperty('--gdl-rgb', rgb(ba)); root.style.setProperty('--gdl-glow', GLOW[s.glow]);
    if (s.glow !== 'off') root.setAttribute('data-gdl-glow', '');
    if (s.card !== 'glass') root.setAttribute('data-gdl-card', s.card);
    if (s.radius !== 'soft') { root.setAttribute('data-gdl-r', ''); root.style.setProperty('--gdl-r', RAD[s.radius]); }
    if (s.density !== 'comfortable') root.setAttribute('data-gdl-density', s.density);
    if (s.font !== 'default') {
      const f = FONTS[s.font][1];
      if (!$('gdlFont-' + s.font)) { const l = d.createElement('link'); l.id = 'gdlFont-' + s.font; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@400;500;600;700&display=swap'; d.head.appendChild(l); }
      root.setAttribute('data-gdl-font', ''); root.style.setProperty('--gdl-font', `'${f}'`);
    }
  }
  const seg = (k, opts, cur) => `<div class="gs-seg" role="group">${Object.entries(opts).map(([v, t]) => `<button type="button" data-sk="${k}" data-sv="${v}" class="${cur === v ? 'on' : ''}">${Array.isArray(t) ? t[0] : t}</button>`).join('')}</div>`;
  function html() {
    const s = read(), [, ba] = colors(s);
    return `<div id="gdStudio"><div class="card gs gs-hero"><div class="ep-kicker">Portal Studio · Elite</div><h3>Make the desk look the way you trade</h3>
<p>Elite members control how the whole portal looks. Pick a colour theme, set your own accent, change the typeface, choose between glass, solid or outlined cards, and tune corner shape, spacing and background glow. Every change applies to the entire workspace instantly and is remembered on this device, so your desk is ready the moment you sign in.</p>
<div class="gs-chips"><span>7 colour themes</span><span>Custom accent picker</span><span>6 typefaces</span><span>3 card styles</span><span>Radius &amp; density</span><span>Ambient glow</span></div></div>
<div class="card gs"><div class="ep-kicker">Look</div><h3>Colour theme</h3>
<div class="gs-sw">${Object.entries(PRE).map(([k, v]) => `<button type="button" data-sk="preset" data-sv="${k}" class="${s.preset === k ? 'on' : ''}"><i style="background:${v[2]}"></i>${v[0]}</button>`).join('')}
<button type="button" data-sk="preset" data-sv="custom" class="${s.preset === 'custom' ? 'on' : ''}"><i style="background:${s.custom}"></i>Custom</button></div>
<div class="gs-row"><div><b>Custom accent</b><small>Pick any colour; shades are generated for you</small></div><input type="color" id="gsColor" value="${s.custom}" aria-label="Custom accent colour"></div>
<div class="gs-row"><div><b>Typeface</b><small>Applies to body text, buttons and inputs</small></div>${seg('font', FONTS, s.font)}</div>
<div class="gs-row"><div><b>Card style</b><small>Glass blur, solid fill or a clean outline</small></div>${seg('card', { glass: 'Glass', solid: 'Solid', outline: 'Outline' }, s.card)}</div>
<div class="gs-row"><div><b>Corners</b><small>Cards and buttons</small></div>${seg('radius', { sharp: 'Sharp', soft: 'Soft', round: 'Round' }, s.radius)}</div>
<div class="gs-row"><div><b>Density</b><small>Breathing room inside cards</small></div>${seg('density', { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }, s.density)}</div>
<div class="gs-row"><div><b>Background glow</b><small>Ambient colour behind the workspace</small></div>${seg('glow', { off: 'Off', soft: 'Soft', vivid: 'Vivid' }, s.glow)}</div>
<div class="gs-prev"><span style="width:14px;height:14px;border-radius:50%;background:${ba};box-shadow:0 0 14px ${ba}"></span><b>Live accent</b><span class="ep-sub">${s.preset === 'custom' ? s.custom : PRE[s.preset][0]} · saved on this device</span><button class="btn btn-ghost" type="button" id="gsReset" style="margin-left:auto">Reset to default</button></div></div></div>`;
  }
  const ensure = () => { const h = $('elitePortalRoot'); if (h && eliteNow() && h.firstChild && !$('gdStudio')) h.insertAdjacentHTML('afterbegin', html()); };
  const redraw = () => { const e = $('gdStudio'); if (e) e.outerHTML = html(); };
  const set = (k, v) => { const s = read(); s[k] = v; save(s); apply(); redraw(); };
  d.addEventListener('click', e => {
    const h = $('gdStudio'); if (!h || !h.contains(e.target)) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'gsReset') { save({ ...DEF }); apply(); redraw(); return; }
    if (b.dataset.sk) set(b.dataset.sk, b.dataset.sv);
  });
  d.addEventListener('input', e => { if (e.target.id === 'gsColor') { const s = read(); s.custom = e.target.value; s.preset = 'custom'; save(s); apply(); } });
  d.addEventListener('change', e => { if (e.target.id === 'gsColor') redraw(); });
  const wrap = () => { if (typeof window.applyTierLocks !== 'function' || window.applyTierLocks.__gs) return; const o = window.applyTierLocks; window.applyTierLocks = function () { const r = o.apply(this, arguments); try { apply(); ensure(); } catch (e) {} return r; }; window.applyTierLocks.__gs = true; };
  const boot = () => { apply(); wrap(); const h = $('elitePortalRoot'); if (h) { new MutationObserver(ensure).observe(h, { childList: true }); ensure(); } };
  d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', boot) : boot();
  addEventListener('load', () => { wrap(); apply(); setTimeout(apply, 2500); });
})();
