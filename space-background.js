(() => {
  const canvas = document.getElementById('spaceField');
  const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });
  if (!canvas || !context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  // Touch devices render at 24fps: indistinguishable for slow drifting stars, noticeably lighter on battery.
  const frameInterval = 1000 / (coarsePointer.matches ? 24 : 30);

  // Static (no animation loop) when the person or device asks for it:
  //  - the workspace's Display & Motion switch (gd_motion / html.motion-reduced) wins first
  //  - otherwise the OS reduced-motion setting, Data Saver, or a low-memory / low-core device
  function isStatic() {
    let pref = null;
    try { pref = localStorage.getItem('gd_motion'); } catch (error) {}
    if (pref === 'reduced' || document.documentElement.classList.contains('motion-reduced')) return true;
    if (pref === 'full') return false;
    if (reducedMotion.matches) return true;
    const connection = navigator.connection;
    if (connection && connection.saveData) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    return false;
  }
  const maxCanvasPixels = 3500000;
  const colors = ['226,237,246', '170,210,222', '199,218,198', '222,207,170'];
  const cursor = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let focalLength = 700;
  let stars = [];
  let shootingStars = [];
  let nextShootingStarAt = 0;
  let animationFrame = 0;
  let lastFrame = 0;
  let running = false;
  let activeGlassSurface = null;

  const random = (min, max) => min + Math.random() * (max - min);

  function seedStars() {
    const mobile = width < 720;
    const target = Math.round((width * height) / (mobile ? 7600 : 4700));
    const count = Math.max(mobile ? 62 : 100, Math.min(mobile ? 105 : 205, target));
    stars = Array.from({ length: count }, () => ({
      x: random(-width * 1.05, width * 1.05),
      y: random(-height * 1.05, height * 1.05),
      z: random(80, 1700),
      size: random(0.45, 1.18),
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: random(0, Math.PI * 2),
      flare: Math.random() < 0.02,
    }));
  }

  function scheduleNextShootingStar(time) {
    nextShootingStarAt = time + random(18000, 34000);
    if (shootingStars.length || Math.random() > 0.72) return;

    const fromLeft = Math.random() < 0.5;
    const directionX = fromLeft ? 1 : -1;
    const slope = random(0.12, 0.34);
    const normalizer = Math.hypot(directionX, slope);
    const travel = random(Math.max(180, width * 0.22), Math.max(280, width * 0.46));
    const tailLength = Math.min(150, travel * 0.42);
    shootingStars.push({
      startX: fromLeft ? random(-tailLength, width * 0.32) : random(width * 0.68, width + tailLength),
      startY: random(height * 0.08, height * 0.58),
      directionX: directionX / normalizer,
      directionY: slope / normalizer,
      startAt: time,
      duration: random(680, 980),
      travel,
      tailLength,
      color: Math.random() < 0.72 ? '219,236,246' : '202,224,215',
    });
  }

  function drawShootingStars(time) {
    if (time >= nextShootingStarAt) scheduleNextShootingStar(time);

    for (let index = shootingStars.length - 1; index >= 0; index--) {
      const shot = shootingStars[index];
      const progress = (time - shot.startAt) / shot.duration;
      if (progress >= 1) {
        shootingStars.splice(index, 1);
        continue;
      }

      const eased = 1 - Math.pow(1 - progress, 1.12);
      const x = shot.startX + shot.directionX * shot.travel * eased;
      const y = shot.startY + shot.directionY * shot.travel * eased;
      const envelope = Math.sin(progress * Math.PI);
      const tailX = x - shot.directionX * shot.tailLength;
      const tailY = y - shot.directionY * shot.tailLength;
      const trail = context.createLinearGradient(tailX, tailY, x, y);
      trail.addColorStop(0, `rgba(${shot.color},0)`);
      trail.addColorStop(0.68, `rgba(${shot.color},${0.12 * envelope})`);
      trail.addColorStop(1, `rgba(${shot.color},${0.76 * envelope})`);

      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(x, y);
      context.lineCap = 'round';
      context.lineWidth = 1.35;
      context.strokeStyle = trail;
      context.stroke();

      context.beginPath();
      context.arc(x, y, 1.25, 0, Math.PI * 2);
      context.fillStyle = `rgba(240,248,250,${0.82 * envelope})`;
      context.fill();
    }
  }

  function render(time, animate) {
    context.clearRect(0, 0, width, height);

    const drift = animate ? time * 0.00008 : 0;
    const cameraX = (cursor.x * 138 + Math.sin(drift) * 44);
    const cameraY = (cursor.y * 82 + Math.cos(drift * 0.76) * 28);
    const frameScale = Math.min(2.5, Math.max(0.5, (time - (lastFrame || time - 16.7)) / 16.7));

    for (const star of stars) {
      if (animate) {
        star.z -= 0.31 * frameScale;
        if (star.z < 68) {
          star.x = random(-width * 1.05, width * 1.05);
          star.y = random(-height * 1.05, height * 1.05);
          star.z = random(1550, 1900);
          star.prevX = undefined;
          star.prevY = undefined;
        }
      }

      const perspective = focalLength / (focalLength + star.z);
      const x = width * 0.5 + (star.x - cameraX) * perspective;
      const y = height * 0.48 + (star.y - cameraY) * perspective;
      if (x < -8 || x > width + 8 || y < -8 || y > height + 8) {
        star.prevX = undefined;
        star.prevY = undefined;
        continue;
      }

      const depth = 1 - star.z / 1900;
      const twinkle = isStatic() ? 0.92 : 0.8 + Math.sin(time * 0.0011 + star.phase) * 0.2;
      const radius = (0.45 + perspective * 1.15) * star.size;
      const alpha = (0.2 + depth * 0.55) * twinkle;

      if (animate && depth > 0.62 && Number.isFinite(star.prevX) && Number.isFinite(star.prevY)) {
        const trailLength = Math.hypot(x - star.prevX, y - star.prevY);
        if (trailLength > 0.07) {
          context.beginPath();
          context.moveTo(star.prevX, star.prevY);
          context.lineTo(x, y);
          context.strokeStyle = `rgba(${star.color},${alpha * 0.24})`;
          context.lineWidth = Math.min(1.5, radius * 0.8);
          context.stroke();
        }
      }
      star.prevX = x;
      star.prevY = y;

      if (animate && star.flare && depth > 0.78) {
        context.beginPath();
        context.moveTo(x - radius * 3.2, y);
        context.lineTo(x + radius * 3.2, y);
        context.moveTo(x, y - radius * 2.2);
        context.lineTo(x, y + radius * 2.2);
        context.strokeStyle = `rgba(${star.color},${alpha * 0.2})`;
        context.lineWidth = Math.max(0.35, radius * 0.34);
        context.stroke();
      }

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${star.color},${alpha})`;
      context.fill();

      if (depth > 0.84 && radius > 1.1) {
        context.beginPath();
        context.arc(x, y, radius * 3.4, 0, Math.PI * 2);
        context.fillStyle = `rgba(${star.color},${alpha * 0.045})`;
        context.fill();
      }
    }

    if (animate) drawShootingStars(time);
    else shootingStars.length = 0;
  }

  function draw(time) {
    animationFrame = 0;
    if (!running) return;
    if (document.hidden) {
      running = false;
      return;
    }
    if (time - lastFrame < frameInterval && lastFrame) {
      animationFrame = requestAnimationFrame(draw);
      return;
    }

    cursor.x += (cursor.targetX - cursor.x) * 0.035;
    cursor.y += (cursor.targetY - cursor.y) * 0.035;
    render(time, !isStatic());
    lastFrame = time;

    if (isStatic()) {
      running = false;
      return;
    }
    animationFrame = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    animationFrame = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const areaScale = Math.sqrt(maxCanvasPixels / Math.max(1, width * height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25, areaScale);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    focalLength = Math.max(width, height) * 0.82;
    seedStars();
    shootingStars.length = 0;
    nextShootingStarAt = performance.now() + random(7000, 15000);
    lastFrame = 0;
    if (isStatic()) render(performance.now(), false);
    else start();
  }

  function updateGlassHighlight(event) {
    if (!finePointer.matches || !(event.target instanceof Element)) return;
    const surface = event.target.closest('.method-card, .feature, .plan, .market-embed, .market-watch-config, .invite-cta');
    if (activeGlassSurface && activeGlassSurface !== surface) {
      activeGlassSurface.style.removeProperty('--glass-x');
      activeGlassSurface.style.removeProperty('--glass-y');
      activeGlassSurface.style.removeProperty('--glass-tilt-x');
      activeGlassSurface.style.removeProperty('--glass-tilt-y');
    }
    activeGlassSurface = surface;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
    surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
    const normalizedX = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const normalizedY = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    surface.style.setProperty('--glass-tilt-x', `${(normalizedY * -3.4).toFixed(2)}deg`);
    surface.style.setProperty('--glass-tilt-y', `${(normalizedX * 4.2).toFixed(2)}deg`);
  }

  if (finePointer.matches) {
    window.addEventListener('pointermove', event => {
      cursor.targetX = (event.clientX / Math.max(1, width) - 0.5) * 2;
      cursor.targetY = (event.clientY / Math.max(1, height) - 0.5) * 2;
      updateGlassHighlight(event);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
      cursor.targetX = 0;
      cursor.targetY = 0;
      activeGlassSurface?.style.removeProperty('--glass-x');
      activeGlassSurface?.style.removeProperty('--glass-y');
      activeGlassSurface?.style.removeProperty('--glass-tilt-x');
      activeGlassSurface?.style.removeProperty('--glass-tilt-y');
      activeGlassSurface = null;
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else {
      lastFrame = 0;
      start();
    }
  });
  let wasStatic = isStatic();
  function applyMotionPreference() {
    const nowStatic = isStatic();
    if (nowStatic === wasStatic) return; // unrelated class change on <html>
    wasStatic = nowStatic;
    lastFrame = 0;
    stop();
    if (nowStatic) render(performance.now(), false);
    else start();
  }
  reducedMotion.addEventListener?.('change', applyMotionPreference);
  // The workspace Display & Motion switch toggles html.motion-reduced; follow it live.
  if (window.MutationObserver) {
    new MutationObserver(applyMotionPreference).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();
})();

