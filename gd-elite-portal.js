/* Ghost Discipline — Elite Portal (Elite and Premium).
   Renders #view-elite, keeps the "elite ok" marker in sync with the signed-in tier, and drives the opt-in 3D workspace.
   Gating note: like the Team room, tier checks here are a client-side convenience for a visual feature, not a security boundary. */
(() => {
  const d = document, $ = id => d.getElementById(id);
  const OK = 'gd_elite_ok';
  const isEliteNow = () => { try { return typeof tierAtLeast === 'function' && tierAtLeast('elite'); } catch (e) { return false; } };
  const cfg = () => (window.GD3D ? GD3D.settings() : (() => { try { return JSON.parse(localStorage.getItem('gd_elite_portal') || '{}'); } catch (e) { return {}; } })());
  const ACC = { teal: '#5eead4', violet: '#a78bfa', gold: '#f0c878', rose: '#fb7185' };
  const SESSIONS = [['Sydney', 22, 7], ['Tokyo', 0, 9], ['London', 8, 17], ['New York', 13, 22]];  // UTC hours, approximate (ignores DST)

  /* ---- keep the marker honest: wrap applyTierLocks, which app.html calls whenever the tier resolves or changes ---- */
  function syncMarker() {
    const ok = isEliteNow();
    try { localStorage.setItem(OK, ok ? '1' : '0'); } catch (e) {}
    if (!ok && window.GD3D && GD3D.isOn()) GD3D.suspend();   // keeps the saved preference for when they upgrade again
    if (ok && window.gdLoad3D && cfg().threeD && !(window.GD3D && GD3D.isOn())) gdLoad3D().then(g => g.boot()).catch(() => {});
    if ($('view-elite') && $('view-elite').classList.contains('active')) render();
  }
  const wrap = () => {
    if (typeof window.applyTierLocks !== 'function' || window.applyTierLocks.__gd) return;
    const orig = window.applyTierLocks;
    window.applyTierLocks = function () { const r = orig.apply(this, arguments); try { syncMarker(); } catch (e) {} return r; };
    window.applyTierLocks.__gd = true;
  };

  /* ---- UI ---- */
  const sw = (id, on, label) => `<button type="button" class="switch${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}" aria-label="${label}"></button>`;
  const seg = (key, opts, cur) => `<div class="ep-seg" data-key="${key}" role="group">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;

  function lockedHTML() {
    return `<div class="card ep-lock"><div class="ep-kicker">Elite portal</div><h2 style="justify-content:center">The Elite Portal is for <span class="accent">Elite</span> and up</h2>
      <p class="page-sub" style="max-width:460px;margin:8px auto 20px">Switch on the cinematic 3D workspace, tune the scene to your desk, and use the portal tools reserved for Elite and Premium members.</p>
      <button class="btn btn-primary" type="button" onclick="openPackageRequest('elite')">Request Elite →</button></div>`;
  }
  function portalHTML() {
    const s = cfg(), on = !!s.threeD, dim = on ? '' : ' style="opacity:.45;pointer-events:none"';
    return `<div class="ep-grid">
      <div class="card ep-card"><div class="ep-kicker">Workspace</div><h3>3D workspace <span class="ep-pill">Elite</span></h3>
        <p class="ep-sub">Off by default. When enabled it plays a 30-second motion load, then transforms into a live depth scene behind your desk.</p>
        <div class="ep-row"><div><b>Enable 3D workspace</b><small>Respects your Display &amp; Motion setting</small></div>${sw('epThreeD', on, 'Enable 3D workspace')}</div>
        <div class="ep-row"${dim}><div><b>Scene</b><small>What runs behind the ink pages</small></div>${seg('style', [['terrain', 'Terrain'], ['tunnel', 'Tunnel']], s.style || 'terrain')}</div>
        <div class="ep-row"${dim}><div><b>Intensity</b><small>Density and frame rate</small></div>${seg('intensity', [[1, 'Low'], [2, 'Balanced'], [3, 'High']], s.intensity || 2)}</div>
        <div class="ep-row"${dim}><div><b>Intro</b><small>Replay the 30-second motion load</small></div><button class="btn btn-ghost" type="button" id="epReplay">Replay intro</button></div></div>
      <div class="card ep-card"><div class="ep-kicker">Look</div><h3>Scene style</h3><p class="ep-sub">Accent and depth effects apply while the 3D workspace is on.</p>
        <div class="ep-row"${dim}><div><b>Accent</b><small>Scene lines and the top-right glow</small></div><div class="ep-swatches" data-key="accent">${Object.entries(ACC).map(([k, c]) => `<button type="button" class="ep-swatch${(s.accent || 'teal') === k ? ' on' : ''}" data-v="${k}" aria-label="${k}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="ep-row"${dim}><div><b>Depth tilt</b><small>Cards lean toward your cursor</small></div>${sw('epTilt', s.tilt !== false, 'Depth tilt')}</div></div>
      <div class="card ep-card"><div class="ep-kicker">Tools</div><h3>Session clock</h3><p class="ep-sub">Major forex sessions in UTC. Hours are approximate and do not shift for daylight saving.</p>
        <div class="ep-clock" id="epClock">--:--:--</div><div id="epSessions"></div></div></div>`;
  }
  function tickClock() {
    const c = $('epClock'); if (!c) return;
    const n = new Date(), h = n.getUTCHours(), m = n.getUTCMinutes(), sec = n.getUTCSeconds();
    c.textContent = [h, m, sec].map(x => String(x).padStart(2, '0')).join(':') + ' UTC';
    const frac = h + m / 60;
    $('epSessions').innerHTML = SESSIONS.map(([name, o, cl]) => {
      const span = (cl - o + 24) % 24, el = (frac - o + 24) % 24, open = el < span;
      return `<div class="ep-sess${open ? ' open' : ''}"><span>${name}</span><div class="ep-bar"><i style="width:${open ? (el / span * 100).toFixed(0) : 0}%"></i></div><span class="st">${open ? 'Open' : 'Closed'}</span></div>`;
    }).join('');
  }
  let clockTimer = 0;
  function render() {
    const host = $('elitePortalRoot'); if (!host) return;
    clearInterval(clockTimer);
    if (!isEliteNow()) { host.innerHTML = lockedHTML(); return; }
    host.innerHTML = portalHTML(); tickClock(); clockTimer = setInterval(tickClock, 1000);
  }
  async function toggle3D() {
    const g = await gdLoad3D().catch(() => null);
    if (!g) { if (typeof showToast === 'function') showToast('Could not load the 3D engine. Check your connection.'); return; }
    if (g.isOn()) g.disable(); else if (!g.enable({ intro: true }) && typeof showToast === 'function') showToast('3D workspace is available on Elite and Premium.');
    render();
  }
  d.addEventListener('click', async e => {
    const host = $('elitePortalRoot'); if (!host || !host.contains(e.target)) return;
    const t = e.target.closest('button,.switch'); if (!t || !isEliteNow()) return;
    if (t.id === 'epThreeD') return toggle3D();
    if (t.id === 'epReplay') { const g = await gdLoad3D().catch(() => null); if (g) g.replayIntro(); return; }
    if (t.id === 'epTilt') { const g = await gdLoad3D().catch(() => null); if (g) { g.set({ tilt: !(g.settings().tilt !== false) }); render(); } return; }
    const holder = t.closest('[data-key]'); if (!holder || !t.dataset.v) return;
    const g = await gdLoad3D().catch(() => null); if (!g) return;
    const k = holder.dataset.key, v = k === 'intensity' ? +t.dataset.v : t.dataset.v;
    g.set({ [k]: v });
    render();
  });
  d.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('switch') && e.target.closest('#elitePortalRoot')) { e.preventDefault(); e.target.click(); } });
  d.addEventListener('gd3d:introend', () => { if ($('view-elite') && $('view-elite').classList.contains('active')) render(); });

  window.renderElitePortal = render;
  wrap(); d.addEventListener('DOMContentLoaded', wrap); addEventListener('load', wrap);   // marker is only written once app.html reports a resolved tier
})();
