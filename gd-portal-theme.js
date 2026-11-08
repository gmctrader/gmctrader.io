/* Ghost Discipline — shared portal theme runtime: injects the 3D background layers, ensures the starfield
   exists on every page, and drives pointer parallax + glass glint/tilt. No dependencies. */
(() => {
  const d = document, root = d.documentElement;
  const start = () => {
    if (d.getElementById('gdxBg')) return;
    root.setAttribute('data-gdx', '');
    const bg = d.createElement('div');
    bg.id = 'gdxBg'; bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<i class="gdx-glow a"></i><i class="gdx-glow b"></i><i class="gdx-grid"></i><i class="gdx-vig"></i>';
    d.body.prepend(bg);
    // pages without the shared starfield (admin, welcome) get one
    if (!d.getElementById('spaceField')) {
      const c = d.createElement('canvas');
      c.id = 'spaceField'; c.className = 'space-field'; c.setAttribute('aria-hidden', 'true');
      bg.after(c);
      if (!d.querySelector('script[src*="space-background"]')) {
        const s = d.createElement('script'); s.src = 'space-background.js'; s.defer = true; d.head.appendChild(s);
      }
    }
    let still = false;
    try { still = localStorage.getItem('gd_motion') === 'reduced'; } catch (e) {}
    if (still || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const SURF = '.card,.auth-card,.package-card,.eq-dark-card,.pf-archive-card,.hero-stat,.pe-tile,.sig-card,.provider-card,.prompt-card,.gate-card,.method-card,.feature,.plan,.quick-scife-modal,.onboarding-modal';
    const TILT = '.package-card,.hero-stat,.prompt-card,.provider-card,.sig-card,.pe-tile,.eq-dark-card,.pf-archive-card,.method-card,.feature,.plan';
    let raf = 0, ev = null;
    const run = () => {
      raf = 0; const e = ev; if (!e) return;
      root.style.setProperty('--px', (e.clientX / innerWidth - .5).toFixed(3));
      root.style.setProperty('--py', (e.clientY / innerHeight - .5).toFixed(3));
      const t = e.target.closest && e.target.closest(SURF);
      if (!t) return;
      const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); t.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      if (t.matches(TILT)) { t.style.setProperty('--ty', ((x - .5) * 7).toFixed(2) + 'deg'); t.style.setProperty('--tx', ((.5 - y) * 7).toFixed(2) + 'deg'); }
    };
    d.addEventListener('pointermove', e => { ev = e; if (!raf) raf = requestAnimationFrame(run); }, { passive: true });
    d.addEventListener('pointerout', e => {
      const t = e.target.closest && e.target.closest(TILT);
      if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--tx', '0deg'); t.style.setProperty('--ty', '0deg'); }
    }, { passive: true });
  };
  d.body ? start() : d.addEventListener('DOMContentLoaded', start);
})();
