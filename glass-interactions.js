(() => {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function trackGlassHighlight() {
    document.querySelectorAll('.nav, .desktop-nav').forEach(surface => {
      surface.addEventListener('pointermove', event => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
        surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
      surface.addEventListener('pointerleave', () => {
        surface.style.setProperty('--glass-x', '50%');
        surface.style.setProperty('--glass-y', '0%');
      }, { passive: true });
    });
  }

  function initPreviewDeck() {
    const track = document.getElementById('previewTrack');
    if (!track) return;
    const carousel = document.getElementById('previewCarousel');
    const cards = [...track.querySelectorAll('.preview-card')];
    const dots = [...(document.getElementById('previewDots')?.querySelectorAll('button') || [])];
    const counter = document.getElementById('previewSlideCount');
    const previous = document.getElementById('previewPrev');
    const next = document.getElementById('previewNext');
    if (!cards.length) return;

    cards.forEach((card, index) => {
      card.setAttribute('role', 'group');
      card.setAttribute('aria-roledescription', 'slide');
      card.setAttribute('aria-label', `${index + 1} of ${cards.length}`);
      const image = card.querySelector('img');
      if (image) image.draggable = false;
    });
    dots.forEach((dot, index) => { dot.dataset.slide = String(index); });

    let frame = 0;
    let inertiaFrame = 0;
    let drag = null;
    let dragged = false;
    let suppressClickUntil = 0;
    let activeIndex = 0;

    function nearestIndex() {
      const center = track.getBoundingClientRect().left + track.clientWidth / 2;
      let best = 0;
      let distance = Infinity;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const current = Math.abs(rect.left + rect.width / 2 - center);
        if (current < distance) { distance = current; best = index; }
      });
      return best;
    }

    function updateDeck() {
      frame = 0;
      const center = track.getBoundingClientRect().left + track.clientWidth / 2;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const progress = (rect.left + rect.width / 2 - center) / Math.max(1, rect.width);
        const distance = Math.abs(progress);
        card.style.setProperty('--card-yaw', `${clamp(progress * -10, -12, 12)}deg`);
        card.style.setProperty('--card-depth', `${24 - Math.min(145, distance * 150)}px`);
        card.style.setProperty('--card-scale', String(1 - Math.min(.12, distance * .105)));
        card.style.setProperty('--card-opacity', String(Math.max(.42, 1 - distance * .46)));
        card.classList.toggle('is-centered', index === activeIndex);
      });
      const found = nearestIndex();
      if (found !== activeIndex) activeIndex = found;
      cards.forEach((card, index) => card.classList.toggle('is-centered', index === activeIndex));
      dots.forEach((dot, index) => {
        if (index === activeIndex) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      if (counter) counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    }

    function requestDeckUpdate() { if (!frame) frame = requestAnimationFrame(updateDeck); }
    function stopInertia() { if (inertiaFrame) cancelAnimationFrame(inertiaFrame); inertiaFrame = 0; }
    function centerCard(index, behavior = reducedMotion ? 'auto' : 'smooth') {
      stopInertia();
      track.style.removeProperty('--deck-rubber');
      const card = cards[(index + cards.length) % cards.length];
      const rect = card.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      track.scrollTo({ left: track.scrollLeft + rect.left + rect.width / 2 - (trackRect.left + track.clientWidth / 2), behavior });
      activeIndex = (index + cards.length) % cards.length;
      requestDeckUpdate();
    }

    function snapNearest() { centerCard(nearestIndex()); }

    function coast(velocity) {
      if (reducedMotion || Math.abs(velocity) < .025) { snapNearest(); return; }
      let previousTime = performance.now();
      const tick = time => {
        const elapsed = Math.min(32, time - previousTime);
        previousTime = time;
        track.scrollLeft += velocity * elapsed;
        velocity *= Math.exp(-elapsed / 270);
        requestDeckUpdate();
        if (Math.abs(velocity) > .025) inertiaFrame = requestAnimationFrame(tick);
        else { inertiaFrame = 0; snapNearest(); }
      };
      inertiaFrame = requestAnimationFrame(tick);
    }

    track.addEventListener('scroll', requestDeckUpdate, { passive: true });
    track.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
      stopInertia();
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startScroll: track.scrollLeft, lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false };
      try { track.setPointerCapture(event.pointerId); } catch {}
    });
    track.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.25) { drag = null; track.classList.remove('is-dragging'); return; }
      if (Math.abs(dx) > 4) {
        drag.moved = true;
        track.classList.add('is-dragging');
        event.preventDefault();
      }
      if (!drag.moved) return;
      const now = performance.now();
      const elapsed = Math.max(1, now - drag.lastTime);
      drag.velocity = clamp(-(event.clientX - drag.lastX) / elapsed, -1.35, 1.35);
      drag.lastX = event.clientX;
      drag.lastTime = now;
      const target = drag.startScroll - dx;
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      track.scrollLeft = Math.max(0, Math.min(max, target));
      const overshoot = target < 0 ? target : target > max ? target - max : 0;
      if (overshoot) track.style.setProperty('--deck-rubber', `${clamp(overshoot * .28, -76, 76)}px`);
      else track.style.removeProperty('--deck-rubber');
      requestDeckUpdate();
    });
    track.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const wasDragged = drag.moved;
      const velocity = drag.velocity;
      drag = null;
      track.classList.remove('is-dragging');
      track.style.removeProperty('--deck-rubber');
      if (wasDragged) {
        dragged = true;
        suppressClickUntil = performance.now() + 220;
        window.setTimeout(() => { dragged = false; }, 230);
        coast(velocity);
      } else snapNearest();
    });
    track.addEventListener('pointercancel', () => {
      drag = null;
      track.classList.remove('is-dragging');
      track.style.removeProperty('--deck-rubber');
      snapNearest();
    });
    track.addEventListener('click', event => {
      if (dragged || performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    }, true);
    track.addEventListener('pointermove', event => {
      const card = event.target.closest('.preview-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--shine-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--shine-y', `${event.clientY - rect.top}px`);
      if (!track.classList.contains('is-dragging')) {
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.setProperty('--card-lift', `${Math.abs(x) + Math.abs(y) < .1 ? 0 : -2}px`);
      }
    }, { passive: true });
    previous?.addEventListener('click', () => centerCard(activeIndex - 1));
    next?.addEventListener('click', () => centerCard(activeIndex + 1));
    dots.forEach((dot, index) => dot.addEventListener('click', () => centerCard(index)));
    track.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); centerCard(activeIndex + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); centerCard(activeIndex - 1); }
      if (event.key === 'Home') { event.preventDefault(); centerCard(0); }
      if (event.key === 'End') { event.preventDefault(); centerCard(cards.length - 1); }
    });
    window.addEventListener('resize', requestDeckUpdate, { passive: true });
    if (carousel) {
      carousel.setAttribute('role', 'region');
      carousel.setAttribute('aria-label', 'Interactive product tour');
      carousel.setAttribute('aria-roledescription', 'carousel');
    }
    requestAnimationFrame(() => centerCard(0, 'auto'));
  }

  function initOnboardingDrag() {
    const stage = document.getElementById('onboardingStage');
    if (!stage || typeof window.moveOnboardingStep !== 'function') return;
    let drag = null;
    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      try { stage.setPointerCapture(event.pointerId); } catch {}
    });
    stage.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) { drag = null; return; }
      if (Math.abs(dx) < 4) return;
      drag.moved = true;
      stage.classList.add('is-dragging');
      const width = Math.max(1, stage.clientWidth);
      const progress = clamp(Math.abs(dx) / width, 0, .24);
      stage.style.setProperty('--onboard-drag-x', `${dx * .72}px`);
      stage.style.setProperty('--onboard-drag-yaw', `${clamp(-dx / width * 13, -4, 4)}deg`);
      stage.style.setProperty('--onboard-drag-scale', String(1 - progress * .045));
      event.preventDefault();
    });
    const finish = (event, cancelled = false) => {
      if (!drag || (event && drag.id !== event.pointerId)) return;
      const current = drag;
      const dx = event ? event.clientX - current.x : 0;
      const direction = !cancelled && Math.abs(dx) > Math.max(76, stage.clientWidth * .16) ? (dx < 0 ? 1 : -1) : 0;
      drag = null;
      stage.classList.remove('is-dragging');
      if (direction) {
        stage.classList.add('is-settling');
        stage.style.setProperty('--onboard-drag-x', `${Math.sign(dx) * stage.clientWidth * .86}px`);
        window.setTimeout(() => {
          stage.classList.remove('is-settling');
          stage.style.removeProperty('--onboard-drag-x');
          stage.style.removeProperty('--onboard-drag-yaw');
          stage.style.removeProperty('--onboard-drag-scale');
          window.moveOnboardingStep(direction);
        }, 90);
      } else {
        stage.classList.add('is-settling');
        stage.style.setProperty('--onboard-drag-x', '0px');
        stage.style.setProperty('--onboard-drag-yaw', '0deg');
        stage.style.setProperty('--onboard-drag-scale', '1');
        window.setTimeout(() => {
          stage.classList.remove('is-settling');
          stage.style.removeProperty('--onboard-drag-x');
          stage.style.removeProperty('--onboard-drag-yaw');
          stage.style.removeProperty('--onboard-drag-scale');
        }, 380);
      }
    };
    stage.addEventListener('pointerup', event => finish(event));
    stage.addEventListener('pointercancel', event => finish(event, true));
  }

  function initAuthCardDrag() {
    const card = document.querySelector('#authScreen .auth-card');
    if (!card) return;
    if (!card.querySelector('.gd-auth-drag-hint')) {
      const hint = document.createElement('div');
      hint.className = 'gd-auth-drag-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = '<svg viewBox="0 0 24 14"><path d="M7 3 3 7l4 4M3 7h18m-4-4 4 4-4 4"/></svg><span>Drag glass to switch</span>';
      card.appendChild(hint);
    }
    const baseSetAuthMode = window.setAuthMode;
    if (typeof baseSetAuthMode === 'function' && !baseSetAuthMode.__glassWrapped) {
      const wrappedSetAuthMode = function(mode) {
        card.classList.remove('gd-auth-mode-change');
        void card.offsetWidth;
        const result = baseSetAuthMode.call(this, mode);
        card.classList.add('gd-auth-mode-change');
        window.setTimeout(() => card.classList.remove('gd-auth-mode-change'), 420);
        return result;
      };
      wrappedSetAuthMode.__glassWrapped = true;
      window.setAuthMode = wrappedSetAuthMode;
    }

    let drag = null;
    let settleTimer = 0;
    card.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      try { card.setPointerCapture(event.pointerId); } catch {}
    });
    card.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15) { drag = null; return; }
      if (Math.abs(dx) < 4) return;
      drag.moved = true;
      card.classList.add('is-auth-dragging');
      const width = Math.max(1, card.clientWidth);
      card.style.setProperty('--auth-drag-x', `${dx * .76}px`);
      card.style.setProperty('--auth-drag-yaw', `${clamp(-dx / width * 12, -5, 5)}deg`);
      card.style.setProperty('--auth-drag-pitch', `${clamp(-dy / width * 5, -2.5, 2.5)}deg`);
      card.style.setProperty('--auth-drag-scale', String(1 - Math.min(.018, Math.abs(dx / width) * .018)));
      event.preventDefault();
    });
    const finish = (event, cancelled = false) => {
      if (!drag || (event && drag.id !== event.pointerId)) return;
      const current = drag;
      const dx = event ? event.clientX - current.x : 0;
      const changed = current.moved && !cancelled && Math.abs(dx) > Math.max(86, card.clientWidth * .17);
      drag = null;
      card.classList.remove('is-auth-dragging');
      card.classList.add('is-auth-settling');
      if (changed) {
        card.style.setProperty('--auth-drag-x', `${Math.sign(dx) * card.clientWidth * .34}px`);
        card.style.setProperty('--auth-drag-yaw', `${dx < 0 ? 3.5 : -3.5}deg`);
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          card.style.setProperty('--auth-drag-x', '0px');
          card.style.setProperty('--auth-drag-yaw', '0deg');
          card.style.setProperty('--auth-drag-pitch', '0deg');
          card.style.setProperty('--auth-drag-scale', '1');
          if (typeof window.toggleAuthMode === 'function') window.toggleAuthMode();
          settleTimer = window.setTimeout(() => {
            card.classList.remove('is-auth-settling');
            card.style.removeProperty('--auth-drag-x');
            card.style.removeProperty('--auth-drag-yaw');
            card.style.removeProperty('--auth-drag-pitch');
            card.style.removeProperty('--auth-drag-scale');
          }, 360);
        }, 110);
      } else {
        card.style.setProperty('--auth-drag-x', '0px');
        card.style.setProperty('--auth-drag-yaw', '0deg');
        card.style.setProperty('--auth-drag-pitch', '0deg');
        card.style.setProperty('--auth-drag-scale', '1');
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          card.classList.remove('is-auth-settling');
          card.style.removeProperty('--auth-drag-x');
          card.style.removeProperty('--auth-drag-yaw');
          card.style.removeProperty('--auth-drag-pitch');
          card.style.removeProperty('--auth-drag-scale');
        }, 420);
      }
    };
    card.addEventListener('pointerup', event => finish(event));
    card.addEventListener('pointercancel', event => finish(event, true));
  }

  function initWorkspaceSwipe() {
    const hud = document.getElementById('hud');
    const appShell = document.getElementById('appShell');
    const sideNav = document.getElementById('sideNav');
    if (!hud || !appShell || !sideNav) return;
    const entries = [...sideNav.querySelectorAll('.side-navbtn[data-view]')]
      .filter(button => document.getElementById(`view-${button.dataset.view}`));
    let lastView = entries.find(button => button.classList.contains('active'))?.dataset.view || 'dashboard';
    let pendingDirection = null;
    let gesture = null;
    let settleTimer = 0;

    function setPreview(current, direction) {
      if (current.preview) {
        current.preview.classList.remove('gd-swipe-preview');
        current.preview.style.removeProperty('--gd-preview-x');
        current.preview.style.removeProperty('--gd-preview-yaw');
        current.preview.style.removeProperty('top');
      }
      current.direction = direction;
      const nextIndex = (current.fromIndex + direction + entries.length) % entries.length;
      current.button = entries[nextIndex];
      current.preview = document.getElementById(`view-${current.button.dataset.view}`);
      if (!current.preview) return false;
      current.preview.classList.add('gd-swipe-preview');
      current.preview.style.top = `${current.active.offsetTop}px`;
      return true;
    }

    function clearGestureClasses() {
      hud.classList.remove('gd-swipe-active', 'gd-swipe-settling', 'gd-swipe-returning');
      hud.querySelectorAll('.gd-swiping-current,.gd-swipe-preview').forEach(view => {
        view.classList.remove('gd-swiping-current', 'gd-swipe-preview');
        view.style.removeProperty('--gd-current-x');
        view.style.removeProperty('--gd-current-yaw');
        view.style.removeProperty('--gd-current-scale');
        view.style.removeProperty('--gd-current-opacity');
        view.style.removeProperty('--gd-preview-x');
        view.style.removeProperty('--gd-preview-yaw');
        view.style.removeProperty('top');
      });
    }

    document.addEventListener('click', event => {
      const button = event.target.closest?.('.side-navbtn[data-view]');
      if (!button || !button.classList.contains('active') || button.dataset.view === lastView) return;
      const activeView = document.getElementById(`view-${button.dataset.view}`);
      if (!activeView) return;
      const fromIndex = entries.findIndex(item => item.dataset.view === lastView);
      const toIndex = entries.findIndex(item => item.dataset.view === button.dataset.view);
      const direction = pendingDirection || (toIndex >= fromIndex ? 1 : -1);
      activeView.classList.remove('gd-enter-from-next', 'gd-enter-from-previous');
      activeView.classList.add(direction > 0 ? 'gd-enter-from-next' : 'gd-enter-from-previous');
      window.setTimeout(() => activeView.classList.remove('gd-enter-from-next', 'gd-enter-from-previous'), 460);
      lastView = button.dataset.view;
      pendingDirection = null;
    });

    hud.addEventListener('pointerdown', event => {
      if (!appShell.classList.contains('show')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('button, a, input, textarea, select, iframe, canvas, [contenteditable="true"], .market-embed, .equity-wrap, .table-wrap, [data-no-swipe]')) return;
      const active = hud.querySelector('.view.active');
      const fromIndex = entries.findIndex(button => button.dataset.view === lastView);
      if (!active || fromIndex < 0 || entries.length < 2) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastTime: performance.now(), velocity: 0, active, preview: null, direction: 0, moved: false, fromIndex };
      try { hud.setPointerCapture(event.pointerId); } catch {}
    });

    hud.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15) { gesture = null; return; }
      if (!gesture.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        gesture.moved = true;
        gesture.direction = dx < 0 ? 1 : -1;
        if (!setPreview(gesture, gesture.direction)) { gesture = null; return; }
        gesture.active.classList.add('gd-swiping-current');
        hud.classList.add('gd-swipe-active');
      }
      if (!gesture.moved) return;
      const direction = dx < 0 ? 1 : -1;
      if (direction !== gesture.direction && Math.abs(dx) > 8) setPreview(gesture, direction);
      const width = Math.max(1, hud.clientWidth);
      const progress = clamp(Math.abs(dx) / width, 0, .95);
      const now = performance.now();
      gesture.velocity = clamp((event.clientX - gesture.lastX) / Math.max(1, now - gesture.lastTime), -1.4, 1.4);
      gesture.lastX = event.clientX;
      gesture.lastTime = now;
      gesture.active.style.setProperty('--gd-current-x', `${dx * .74}px`);
      gesture.active.style.setProperty('--gd-current-yaw', `${clamp(dx / width * 8, -5, 5)}deg`);
      gesture.active.style.setProperty('--gd-current-scale', String(1 - progress * .025));
      gesture.active.style.setProperty('--gd-current-opacity', String(1 - progress * .2));
      const initial = gesture.direction > 0 ? 34 : -34;
      gesture.preview.style.setProperty('--gd-preview-x', `${initial * (1 - progress)}%`);
      gesture.preview.style.setProperty('--gd-preview-yaw', `${gesture.direction > 0 ? -4 : 4}deg`);
      event.preventDefault();
    });

    function finishGesture(event, cancelled = false) {
      if (!gesture || (event && gesture.id !== event.pointerId)) return;
      const current = gesture;
      if (!current.moved) { gesture = null; return; }
      const dx = event ? event.clientX - current.x : 0;
      const width = Math.max(1, hud.clientWidth);
      const commit = !cancelled && (Math.abs(dx) > Math.max(90, width * .19) || (Math.abs(current.velocity) > .55 && Math.abs(dx) > 34));
      gesture = null;
      if (commit) {
      const direction = current.direction;
        pendingDirection = direction;
        hud.classList.add('gd-swipe-settling');
        current.active.style.setProperty('--gd-current-x', `${direction > 0 ? -width * 1.08 : width * 1.08}px`);
        current.active.style.setProperty('--gd-current-yaw', `${direction > 0 ? -6 : 6}deg`);
        current.active.style.setProperty('--gd-current-opacity', '.12');
        current.preview.style.setProperty('--gd-preview-x', '0%');
        current.preview.style.setProperty('--gd-preview-yaw', '0deg');
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          clearGestureClasses();
          current.button.click();
        }, reducedMotion ? 0 : 325);
      } else {
        hud.classList.add('gd-swipe-returning');
        current.active.style.setProperty('--gd-current-x', '0px');
        current.active.style.setProperty('--gd-current-yaw', '0deg');
        current.active.style.setProperty('--gd-current-scale', '1');
        current.active.style.setProperty('--gd-current-opacity', '1');
        current.preview.style.setProperty('--gd-preview-x', `${current.direction > 0 ? 34 : -34}%`);
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(clearGestureClasses, 390);
      }
    }
    hud.addEventListener('pointerup', event => finishGesture(event));
    hud.addEventListener('pointercancel', event => finishGesture(event, true));
  }

  function initMobileSidebarSwipe() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebarScrim');
    if (!sidebar || !scrim || typeof window.toggleSidebar !== 'function') return;
    let gesture = null;
    let finishTimer = 0;

    const resetDrag = (animate = true) => {
      if (animate) sidebar.classList.add('is-settling');
      sidebar.classList.remove('is-dragging');
      sidebar.style.removeProperty('--gd-sidebar-x');
      sidebar.style.removeProperty('--gd-sidebar-scale');
      scrim.style.removeProperty('--gd-sidebar-scrim-opacity');
      window.clearTimeout(finishTimer);
      finishTimer = window.setTimeout(() => sidebar.classList.remove('is-settling'), animate && !reducedMotion ? 360 : 0);
    };

    sidebar.addEventListener('pointerdown', event => {
      if (!sidebar.classList.contains('open') || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (event.target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false };
    });

    sidebar.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15) { gesture = null; return; }
      if (!gesture.moved && dx > 10) { gesture = null; return; }
      if (!gesture.moved && dx < -8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        gesture.moved = true;
        sidebar.classList.remove('is-settling');
        sidebar.classList.add('is-dragging');
        try { sidebar.setPointerCapture(event.pointerId); } catch {}
      }
      if (!gesture.moved) return;
      const now = performance.now();
      gesture.velocity = (event.clientX - gesture.lastX) / Math.max(1, now - gesture.lastTime);
      gesture.lastX = event.clientX;
      gesture.lastTime = now;
      const width = Math.max(1, sidebar.getBoundingClientRect().width);
      const offset = Math.max(-width, Math.min(0, dx));
      const progress = Math.min(1, Math.abs(offset) / width);
      sidebar.style.setProperty('--gd-sidebar-x', `${offset}px`);
      sidebar.style.setProperty('--gd-sidebar-scale', String(1 - progress * .012));
      scrim.style.setProperty('--gd-sidebar-scrim-opacity', String(Math.max(.12, 1 - progress * .82)));
      event.preventDefault();
    });

    const finish = (event, cancelled = false) => {
      if (!gesture || (event && gesture.id !== event.pointerId)) return;
      const current = gesture;
      gesture = null;
      if (!current.moved) return;
      const dx = event ? event.clientX - current.x : 0;
      const width = Math.max(1, sidebar.getBoundingClientRect().width);
      const dismiss = !cancelled && (dx < -Math.max(76, width * .2) || (current.velocity < -.5 && dx < -30));
      if (dismiss) {
        sidebar.classList.remove('is-dragging');
        sidebar.classList.add('is-settling');
        sidebar.style.removeProperty('--gd-sidebar-x');
        sidebar.style.removeProperty('--gd-sidebar-scale');
        window.toggleSidebar(false);
        window.clearTimeout(finishTimer);
        finishTimer = window.setTimeout(() => sidebar.classList.remove('is-settling'), reducedMotion ? 0 : 380);
      } else resetDrag(true);
    };

    sidebar.addEventListener('pointerup', event => finish(event));
    sidebar.addEventListener('pointercancel', event => finish(event, true));
  }

  function init() {
    trackGlassHighlight();
    initMobileSidebarSwipe();
    initPreviewDeck();
    initAuthCardDrag();
    initOnboardingDrag();
    initWorkspaceSwipe();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
