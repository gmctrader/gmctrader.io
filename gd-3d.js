/* Ghost Discipline — 3D workspace (Elite and up, opt-in). Dependency-free canvas 3D.
   - enable(): plays a 30-second warp-tunnel intro, then transforms into the live scene (terrain or tunnel).
   - boot():   restores the scene on later page loads (short rise-in, no intro).
   Public API: window.GD3D { boot, enable, disable, replayIntro, set, settings, isOn }                        */
(() => {
  if (window.GD3D) return;
  const d = document, root = d.documentElement;
  const KEY = 'gd_elite_portal', OK = 'gd_elite_ok';
  const ACCENTS = { teal: [94, 234, 212], violet: [167, 139, 250], gold: [240, 200, 120], rose: [251, 113, 133] };
  const INDIGO = [124, 140, 255];
  const INTRO_MS = 30000, MORPH_MS = 2800;
  const DEFAULTS = { threeD: false, style: 'terrain', accent: 'teal', intensity: 2, tilt: true, introSeen: false };
  const MSGS = ['Calibrating depth field', 'Mapping session geometry', 'Linking your risk model', 'Rendering workspace layers',
    'Compiling your desk', 'Aligning discipline systems', 'Stabilising the scene', 'Entering your 3D workspace'];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

  let S = Object.assign({}, DEFAULTS);
  const load = () => { try { S = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = Object.assign({}, DEFAULTS); } return S; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const eliteOk = () => { try { return localStorage.getItem(OK) === '1'; } catch (e) { return false; } };
  const reducedMotion = () => {
    let pref = null; try { pref = localStorage.getItem('gd_motion'); } catch (e) {}
    if (pref === 'reduced' || root.classList.contains('motion-reduced')) return true;
    if (pref === 'full') return false;
    return !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  const coarse = () => matchMedia && matchMedia('(pointer: coarse)').matches;

  /* ---------------- state ---------------- */
  let on = false, raf = 0, last = 0, time = 0, w = 0, h = 0, dpr = 1;
  let scene = null, sctx = null, intro = null, ictx = null, hud = null;
  let introT = -1, morphT = -1, morphDone = true, growth = 1, slow = 0, quality = 1;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const accent = () => ACCENTS[S.accent] || ACCENTS.teal;

  /* ---------------- tunnel (shared by intro + tunnel style) ---------------- */
  const RINGS = 26, GAP = 130, DEPTH = RINGS * GAP;
  function makeTunnel() {
    const st = { zoff: 0, streaks: [] };
    for (let i = 0; i < 150; i++) st.streaks.push({ a: Math.random() * 6.283, r: 140 + Math.random() * 760, z: Math.random() * DEPTH, c: Math.random() < .5 ? 0 : 1 });
    return st;
  }
  function drawTunnel(ctx, st, v, dt, cw, ch, cx, cy, alphaMul, acc) {
    const f = Math.min(cw, ch) * 0.92;
    st.zoff += v * dt;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const zs = [];
    for (let k = 0; k < RINGS; k++) zs.push({ k, z: (((k * GAP - st.zoff) % DEPTH) + DEPTH) % DEPTH + 45 });
    zs.sort((a, b) => b.z - a.z);
    const SIDES = 8, pts = zs.map(() => new Array(SIDES));
    zs.forEach((o, n) => {
      const z = o.z, t01 = z / DEPTH, R = 330 + 30 * Math.sin(o.k * .7 + time * .0009);
      const tw = z * .0011 + time * .00018, s = f / z;
      const col = mix(INDIGO, acc, t01);
      const a = Math.pow(1 - t01, 1.3) * sstep(45, 170, z) * alphaMul;
      ctx.beginPath();
      for (let i = 0; i < SIDES; i++) {
        const ang = tw + i * 6.2832 / SIDES, X = cx + Math.cos(ang) * R * s, Y = cy + Math.sin(ang) * R * s;
        pts[n][i] = [X, Y]; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.closePath(); ctx.strokeStyle = rgba(col, a * .85); ctx.lineWidth = Math.max(.6, 2.2 * s * dpr); ctx.stroke();
    });
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < SIDES; i++) {
      ctx.beginPath();
      for (let n = 0; n < pts.length; n++) n ? ctx.lineTo(pts[n][i][0], pts[n][i][1]) : ctx.moveTo(pts[n][i][0], pts[n][i][1]);
      ctx.strokeStyle = rgba(mix(INDIGO, acc, .5), .13 * alphaMul); ctx.stroke();
    }
    const len = 70 + v * 260, groups = [[], []];
    for (const p of st.streaks) {
      p.z -= v * dt * 1.7;
      if (p.z < 40) { p.z = DEPTH; p.a = Math.random() * 6.283; p.r = 140 + Math.random() * 760; }
      groups[p.c].push(p);
    }
    groups.forEach((g, gi) => {
      ctx.beginPath();
      for (const p of g) {
        const s1 = f / p.z, s2 = f / (p.z + len), ca = Math.cos(p.a), sa = Math.sin(p.a);
        ctx.moveTo(cx + ca * p.r * s1, cy + sa * p.r * s1); ctx.lineTo(cx + ca * p.r * s2, cy + sa * p.r * s2);
      }
      ctx.strokeStyle = rgba(gi ? INDIGO : acc, clamp(.28 + v * .1, 0, .7) * alphaMul); ctx.lineWidth = (1 + v * .35) * dpr; ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- terrain (default live scene) ---------------- */
  const motes = [];
  let tbuf = null, tdim = '';
  function drawTerrain(ctx, dt, grow, alphaMul) {
    const q = quality * (S.intensity === 1 ? .62 : S.intensity === 3 ? 1.28 : 1) * (coarse() ? .75 : 1);
    const cols = Math.round(46 * q), rows = Math.round(32 * q), cx_ = 72 / q, cz = 105 / q;
    const halfW = cols * cx_ / 2, rowsDepth = rows * cz;
    const dim = cols + 'x' + rows;
    if (dim !== tdim) { tdim = dim; tbuf = new Float32Array((rows + 1) * (cols + 1) * 3); }
    const acc = accent(), f = h * 0.92, theta = .075 + ptr.y * .04, ct = Math.cos(theta), stt = Math.sin(theta);
    const camX = ptr.x * 130, camY = 150 + ptr.y * 30, camZ = -170, scroll = time * .055, off = scroll % cz;
    for (let j = 0; j <= rows; j++) {
      const zl = j * cz - off;
      for (let i = 0; i <= cols; i++) {
        const x = (i - cols / 2) * cx_, zw = zl + scroll, ax = Math.abs(x) / halfW;
        const lane = Math.pow(Math.min(1, ax * 1.15), 1.6);
        const n = Math.sin(x * .0062 + zw * .0041 + time * .00035) * .5 + Math.sin(x * .0113 - zw * .0067 - time * .0005) * .3 + Math.sin(zw * .0029 + time * .0002) * .2;
        const y = (lane * 220 * (.55 + .45 * n) + n * 20) * grow;
        const xr = x - camX, yr = y - camY, zr = zl - camZ;
        const y2 = yr * ct + zr * stt, z2 = -yr * stt + zr * ct, o = (j * (cols + 1) + i) * 3;
        if (z2 < 60) { tbuf[o + 2] = 0; continue; }
        tbuf[o] = w / 2 + xr * f / z2; tbuf[o + 1] = h * .5 - y2 * f / z2; tbuf[o + 2] = z2;
      }
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1 * dpr; ctx.lineJoin = 'round';
    const wave = (time * .00045) % 1;
    for (let j = 0; j <= rows; j++) {
      const t01 = (j * cz - off) / rowsDepth; if (t01 < 0) continue;
      const boost = Math.exp(-Math.pow((t01 - wave) * 9, 2)) * .55;
      const zm = tbuf[(j * (cols + 1) + (cols >> 1)) * 3 + 2]; if (!zm) continue;
      const a = (Math.pow(1 - clamp(t01, 0, 1), 1.1) * .36 + .04 + boost * .7) * alphaMul * sstep(70, 420, zm);
      ctx.strokeStyle = rgba(mix(INDIGO, acc, clamp(t01 * 1.2, 0, 1)), a); ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= cols; i++) {
        const o = (j * (cols + 1) + i) * 3;
        if (!tbuf[o + 2]) { pen = false; continue; }
        pen ? ctx.lineTo(tbuf[o], tbuf[o + 1]) : ctx.moveTo(tbuf[o], tbuf[o + 1]); pen = true;
      }
      ctx.stroke();
    }
    const band = 4;
    for (let j0 = 0; j0 < rows; j0 += band) {
      const t01 = clamp((j0 * cz - off) / rowsDepth, 0, 1);
      ctx.strokeStyle = rgba(mix(INDIGO, acc, t01), (Math.pow(1 - t01, 1.2) * .22 + .02) * alphaMul * sstep(0.02, .12, t01)); ctx.beginPath();
      for (let i = 0; i <= cols; i++) {
        for (let j = j0; j < Math.min(rows, j0 + band); j++) {
          const o1 = (j * (cols + 1) + i) * 3, o2 = ((j + 1) * (cols + 1) + i) * 3;
          if (!tbuf[o1 + 2] || !tbuf[o2 + 2]) continue;
          ctx.moveTo(tbuf[o1], tbuf[o1 + 1]); ctx.lineTo(tbuf[o2], tbuf[o2 + 1]);
        }
      }
      ctx.stroke();
    }
    /* floating motes */
    const want = Math.round(70 * q);
    while (motes.length < want) motes.push({ x: (Math.random() - .5) * halfW * 2, y: 30 + Math.random() * 420, z: Math.random() * rowsDepth, s: .6 + Math.random() * 1.4, p: Math.random() * 6.28 });
    motes.length = Math.min(motes.length, want);
    ctx.fillStyle = rgba(acc, .7 * alphaMul);
    for (const m of motes) {
      m.z -= dt * .02; m.y += Math.sin(time * .0008 + m.p) * .12; if (m.z < 60) { m.z = rowsDepth; m.x = (Math.random() - .5) * halfW * 2; }
      const xr = m.x - camX, yr = m.y * grow - camY, zr = m.z - camZ, y2 = yr * ct + zr * stt, z2 = -yr * stt + zr * ct;
      if (z2 < 40) continue;
      const sx = w / 2 + xr * f / z2, sy = h * .5 - y2 * f / z2, r = Math.max(.5, m.s * 320 / z2) * dpr;
      ctx.globalAlpha = clamp(1.2 - z2 / (rowsDepth * 1.1), 0, 1) * .8; ctx.fillRect(sx - r / 2, sy - r / 2, r, r);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- canvases / intro DOM ---------------- */
  function sizeCanvas(c) { c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, coarse() ? 1.25 : 1.75); w = Math.round(innerWidth * dpr); h = Math.round(innerHeight * dpr);
    if (scene) sizeCanvas(scene); if (intro) sizeCanvas(intro.querySelector('canvas'));
    if (!raf && on) renderOnce();
  }
  function ensureScene() {
    if (scene) return;
    scene = d.createElement('canvas'); scene.id = 'gd3dScene'; scene.setAttribute('aria-hidden', 'true');
    const bg = d.getElementById('gdxBg'); bg ? bg.after(scene) : d.body.prepend(scene);
    sctx = scene.getContext('2d', { alpha: true }); resize();
  }
  function buildIntro() {
    intro = d.createElement('div'); intro.id = 'gd3dIntro'; intro.setAttribute('role', 'dialog'); intro.setAttribute('aria-label', 'Loading your 3D workspace');
    intro.innerHTML = '<canvas></canvas><div id="gd3dHud" aria-live="polite"><div class="k">Ghost Discipline · 3D workspace</div><div class="m"></div><div class="p"><i></i></div><div class="t"></div></div><button id="gd3dSkip" type="button">Skip intro</button>';
    d.body.appendChild(intro);
    ictx = intro.querySelector('canvas').getContext('2d');
    hud = { m: intro.querySelector('.m'), p: intro.querySelector('.p i'), t: intro.querySelector('.t'), skip: intro.querySelector('#gd3dSkip'), msg: -1, sec: -1 };
    hud.skip.addEventListener('click', skipIntro); resize();
  }
  function speedAt(t) {   // world units per ms
    if (t < 5000) return lerp(.22, .5, sstep(0, 5000, t));
    if (t < 24000) return lerp(.5, 4.2, Math.pow(sstep(5000, 24000, t), 1.6));
    if (t < 28000) return lerp(4.2, .4, sstep(24000, 28000, t));
    return .4;
  }
  let tun = null, sceneTun = null;
  function stepIntro(dt, real) {
    introT += real;
    const t = introT, v = speedAt(Math.min(t, INTRO_MS)), acc = accent();
    if (t >= INTRO_MS && morphT < 0) beginMorph();
    if (morphT >= 0) morphT += real;
    const cw = intro.querySelector('canvas').width, ch = intro.querySelector('canvas').height, cx = cw / 2 + ptr.x * 30 * dpr, cy = ch / 2 + ptr.y * 20 * dpr;
    ictx.globalCompositeOperation = 'source-over'; ictx.clearRect(0, 0, cw, ch); ictx.fillStyle = '#05070a'; ictx.fillRect(0, 0, cw, ch);
    let g = ictx.createRadialGradient(cw, 0, 0, cw, 0, Math.max(cw, ch) * .8); g.addColorStop(0, rgba(acc, .22)); g.addColorStop(1, rgba(acc, 0)); ictx.fillStyle = g; ictx.fillRect(0, 0, cw, ch);
    g = ictx.createRadialGradient(0, ch, 0, 0, ch, Math.max(cw, ch) * .85); g.addColorStop(0, rgba(INDIGO, .25)); g.addColorStop(1, rgba(INDIGO, 0)); ictx.fillStyle = g; ictx.fillRect(0, 0, cw, ch);
    const wasW = w, wasH = h; w = cw; h = ch;
    drawTunnel(ictx, tun, v, dt, cw, ch, cx, cy, 1, acc);
    w = wasW; h = wasH;
    /* convergence flash + shockwave at the transform */
    const flash = t < INTRO_MS ? Math.pow(sstep(28800, INTRO_MS, t), 2) * .85 : Math.max(0, 1 - (t - INTRO_MS) / 1400) * .85;
    if (flash > .01) {
      const fg = ictx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(cw, ch) * (.35 + flash * .5));
      fg.addColorStop(0, rgba([235, 255, 250], flash)); fg.addColorStop(.4, rgba(acc, flash * .45)); fg.addColorStop(1, rgba(acc, 0));
      ictx.globalCompositeOperation = 'lighter'; ictx.fillStyle = fg; ictx.fillRect(0, 0, cw, ch); ictx.globalCompositeOperation = 'source-over';
    }
    if (morphT >= 0) {
      const k = clamp(morphT / MORPH_MS, 0, 1), R = k * Math.hypot(cw, ch) * .7;
      ictx.strokeStyle = rgba(acc, (1 - k) * .8); ictx.lineWidth = (1 + (1 - k) * 8) * dpr; ictx.beginPath(); ictx.arc(cx, cy, R, 0, 6.2832); ictx.stroke();
    }
    /* HUD */
    if (morphT < 0) {
      const msg = Math.min(MSGS.length - 1, Math.floor(t / (INTRO_MS / MSGS.length)));
      if (msg !== hud.msg) { hud.msg = msg; hud.m.textContent = MSGS[msg] + '…'; }
      hud.p.style.width = (clamp(t / INTRO_MS, 0, 1) * 100).toFixed(2) + '%';
      const sec = Math.floor(t / 1000);
      if (sec !== hud.sec) { hud.sec = sec; hud.t.textContent = String(sec).padStart(2, '0') + ' / 30 s'; }
      if (t > 2000) hud.skip.classList.add('show');
    }
  }
  function beginMorph() {
    morphT = 0; morphDone = false; growth = 0; sceneTun = sceneTun || makeTunnel();
    if (hud) { intro.querySelector('#gd3dHud').style.opacity = 0; hud.skip.classList.remove('show'); hud.skip.style.pointerEvents = 'none'; }
    intro.classList.add('out');
    S.introSeen = true; save();
  }
  function skipIntro() { if (intro && introT >= 0 && introT < INTRO_MS) introT = INTRO_MS; }
  function endIntro() {
    if (intro) intro.remove(); intro = ictx = hud = null; introT = -1; morphT = -1; morphDone = true; growth = 1; tun = null;
    d.removeEventListener('keydown', onKey);
    d.dispatchEvent(new CustomEvent('gd3d:introend'));
  }
  const onKey = e => { if (e.key === 'Escape') skipIntro(); };

  /* ---------------- loop ---------------- */
  function drawScene(dt) {
    sctx.clearRect(0, 0, scene.width, scene.height);
    const g = morphDone ? 1 : sstep(0, 1, clamp(morphT / MORPH_MS, 0, 1));
    growth = g;
    if (S.style === 'tunnel') {
      sceneTun = sceneTun || makeTunnel();
      const cx = w / 2 + ptr.x * 40 * dpr, cy = h / 2 + ptr.y * 28 * dpr;
      drawTunnel(sctx, sceneTun, .26, dt, w, h, cx, cy, .55 * g, accent());
    } else drawTerrain(sctx, dt, g, g * .9 + .1 * (morphDone ? 1 : 0));
  }
  function renderOnce() { if (scene) drawScene(16); }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const reduced = reducedMotion(), cap = reduced ? 2 : (S.intensity === 1 || coarse() ? 30 : 60);
    if (now - last < 1000 / cap - 1) return;
    const real = Math.min(250, now - last || 16), dt = Math.min(64, real); last = now;   // intro/morph run on wall-clock time even on slow devices
    if (!reduced) {
      time += dt; ptr.x += (ptr.tx - ptr.x) * .06; ptr.y += (ptr.ty - ptr.y) * .06;
      if (dt > 30) { if (++slow > 45 && quality > .6) { quality = .7; slow = 0; } } else slow = Math.max(0, slow - 1);
    }
    if (intro) {
      stepIntro(dt, real);
      if (morphT >= MORPH_MS) endIntro();
    } else if (!morphDone) { morphT += real; if (morphT >= MORPH_MS) { morphDone = true; morphT = -1; growth = 1; } }
    if (!intro || morphT >= 0) drawScene(dt);
  }

  /* ---------------- pointer parallax + card tilt ---------------- */
  const SURF = '.package-card,.hero-stat,.prompt-card,.provider-card,.sig-card,.pe-tile,.eq-dark-card,.pf-archive-card,.method-card,.feature,.plan,.ep-card';
  let pev = null, praf = 0;
  const onMove = e => { pev = e; if (!praf) praf = requestAnimationFrame(() => {
    praf = 0; const x = pev.clientX / innerWidth - .5, y = pev.clientY / innerHeight - .5; ptr.tx = x; ptr.ty = y;
    if (!S.tilt) return; const t = pev.target.closest && pev.target.closest(SURF); if (!t) return;
    const r = t.getBoundingClientRect(), px = (pev.clientX - r.left) / r.width, py = (pev.clientY - r.top) / r.height;
    t.style.setProperty('--ty', ((px - .5) * 7).toFixed(2) + 'deg'); t.style.setProperty('--tx', ((.5 - py) * 7).toFixed(2) + 'deg');
  }); };
  const onOut = e => { const t = e.target.closest && e.target.closest(SURF); if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--tx', '0deg'); t.style.setProperty('--ty', '0deg'); } };

  /* ---------------- apply / lifecycle ---------------- */
  function applyLook() {
    root.setAttribute('data-gd3d', 'on'); S.tilt ? root.setAttribute('data-gd-tilt', '') : root.removeAttribute('data-gd-tilt');
    root.style.setProperty('--gdx-teal', accent().join(','));
  }
  function start(withIntro) {
    if (!eliteOk()) return false;
    load(); on = true; applyLook(); ensureScene();
    d.addEventListener('pointermove', onMove, { passive: true }); d.addEventListener('pointerout', onOut, { passive: true });
    addEventListener('resize', resize);
    const reduced = reducedMotion();
    if (withIntro && !reduced && !intro) { tun = makeTunnel(); introT = 0; morphT = -1; morphDone = false; growth = 0; buildIntro(); d.addEventListener('keydown', onKey); }
    else if (!reduced) { morphT = 0; morphDone = false; growth = 0; }
    else { morphDone = true; growth = 1; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (reduced) renderOnce();
    return true;
  }
  function stop() {
    on = false; cancelAnimationFrame(raf); raf = 0;
    d.removeEventListener('pointermove', onMove); d.removeEventListener('pointerout', onOut); removeEventListener('resize', resize); d.removeEventListener('keydown', onKey);
    if (scene) scene.remove(); scene = sctx = null; if (intro) intro.remove(); intro = ictx = hud = null; introT = morphT = -1;
    root.removeAttribute('data-gd3d'); root.removeAttribute('data-gd-tilt'); root.style.removeProperty('--gdx-teal');
    d.querySelectorAll(SURF).forEach(el => { el.style.removeProperty('--tx'); el.style.removeProperty('--ty'); });
  }

  window.GD3D = {
    version: 2,
    settings: () => Object.assign({}, load()),
    isOn: () => on,
    suspend() { stop(); },
    boot() { load(); if (S.threeD && !on) start(false); },
    enable(opts) { load(); if (!eliteOk()) return false; S.threeD = true; save(); if (on) stop(); return start(!opts || opts.intro !== false); },
    disable() { load(); S.threeD = false; save(); stop(); },
    replayIntro() { if (!eliteOk()) return false; load(); S.threeD = true; save(); if (on) stop(); return start(true); },
    set(patch) { load(); Object.assign(S, patch); save(); if (on) { applyLook(); renderOnce(); } d.dispatchEvent(new CustomEvent('gd3d:change', { detail: Object.assign({}, S) })); }
  };
})();
