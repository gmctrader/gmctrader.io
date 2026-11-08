/* Ghost Discipline — shared portal theme runtime.
   1) Injects the static background layer (base + teal/indigo glows, see gd-portal-theme.css).
   2) Loads the opt-in 3D workspace (gd-3d.js) ONLY when an Elite-and-up account has switched it on.
   No dependencies. */
(() => {
  const d = document, root = d.documentElement;
  const KEY = 'gd_elite_portal', OK = 'gd_elite_ok';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const eliteOk = () => { try { return localStorage.getItem(OK) === '1'; } catch (e) { return false; } };

  // One loader shared by the portal page and by every other page.
  let loading = null;
  window.gdLoad3D = () => {
    if (window.GD3D) return Promise.resolve(window.GD3D);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = d.createElement('script');
      s.src = 'gd-3d.js'; s.async = true;
      s.onload = () => res(window.GD3D); s.onerror = () => { loading = null; rej(new Error('3D engine failed to load')); };
      d.head.appendChild(s);
    });
    return loading;
  };

  const start = () => {
    if (!d.getElementById('gdxBg')) {
      root.setAttribute('data-gdx', '');
      const bg = d.createElement('div');
      bg.id = 'gdxBg'; bg.setAttribute('aria-hidden', 'true');
      d.body.prepend(bg);
    }
    const onAdmin = /(^|\/)admin(\.html)?$/.test(location.pathname);
    const s = read();
    if (!onAdmin && s.threeD && eliteOk()) window.gdLoad3D().then(g => g && g.boot()).catch(() => {});
  };
  d.body ? start() : d.addEventListener('DOMContentLoaded', start);
})();
