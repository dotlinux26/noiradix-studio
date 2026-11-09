/**
 * NOIRADIX shared project-tab strip interactions.
 *
 * Zero dependencies, static-deployment friendly. Provides:
 *  - smart horizontal drag-scroll for the strip (mouse, pen, touch)
 *  - drag-and-drop reordering of document tabs
 *  - a pinned "new tab" action that always stays first
 *  - keyboard navigation (Arrow/Home/End) and Alt+Arrow reordering
 *
 * The module intentionally never creates or owns tab state. Product adapters
 * render the tabs and pass a callback; the callback owns session ordering.
 */
(function (global) {
  'use strict';

  const DRAG_THRESHOLD = 6;
  const PAN_THRESHOLD = 3;
  const CLICK_SUPPRESS_MS = 280;
  const EDGE_ZONE = 34;
  const MAX_SCROLL_SPEED = 14;

  /**
   * Pure reorder helper (exported for Node tests).
   * Moves `fromId` before/after `referenceId`. A null reference appends.
   */
  function computeReorder(ids, fromId, referenceId, placeAfter) {
    const order = (ids || []).slice();
    const from = order.indexOf(fromId);
    if (from === -1) return order;
    order.splice(from, 1);
    if (referenceId == null) {
      order.push(fromId);
      return order;
    }
    let ref = order.indexOf(referenceId);
    if (ref === -1) {
      order.push(fromId);
      return order;
    }
    if (placeAfter) ref += 1;
    order.splice(ref, 0, fromId);
    return order;
  }

  function attach(strip, options) {
    if (!strip) return null;
    const opts = Object.assign({
      tabSelector: '.project-tab[data-tab-id]',
      onReorder: null,
      onActivate: null,
      onAfterReorder: null
    }, options || {});

    if (strip.__noiradixTabStrip) {
      strip.__noiradixTabStrip.update(opts);
      return strip.__noiradixTabStrip;
    }

    let pan = null;
    let drag = null;
    let suppressClickUntil = 0;
    let ghost = null;
    let autoScrollRaf = 0;
    let autoScrollSpeed = 0;

    function tabs() {
      return Array.from(strip.querySelectorAll(opts.tabSelector));
    }

    function ids() {
      return tabs().map(tab => tab.dataset.tabId);
    }

    function clearDropMarks() {
      tabs().forEach(tab => tab.classList.remove('drop-before', 'drop-after'));
    }

    function dropTargetAt(clientX, draggedTab) {
      const candidates = tabs().filter(tab => tab !== draggedTab);
      for (const tab of candidates) {
        const rect = tab.getBoundingClientRect();
        if (clientX < rect.left + (rect.width / 2)) {
          return { tab, after: false };
        }
      }
      return { tab: candidates[candidates.length - 1] || null, after: true };
    }

    function markDropTarget(target) {
      clearDropMarks();
      if (!target || !target.tab) return;
      target.tab.classList.add(target.after ? 'drop-after' : 'drop-before');
    }

    function stopAutoScroll() {
      autoScrollSpeed = 0;
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = 0;
      }
    }

    function tickAutoScroll() {
      autoScrollRaf = 0;
      if (!drag || !drag.active || !autoScrollSpeed) return;
      strip.scrollLeft += autoScrollSpeed;
      autoScrollRaf = requestAnimationFrame(tickAutoScroll);
    }

    function updateAutoScroll(clientX) {
      const rect = strip.getBoundingClientRect();
      const edge = Math.min(EDGE_ZONE, Math.max(18, rect.width / 4));
      let speed = 0;
      if (clientX < rect.left + edge) {
        speed = -Math.ceil(((rect.left + edge - clientX) / edge) * MAX_SCROLL_SPEED);
      } else if (clientX > rect.right - edge) {
        speed = Math.ceil(((clientX - (rect.right - edge)) / edge) * MAX_SCROLL_SPEED);
      }
      speed = Math.max(-MAX_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, speed));
      autoScrollSpeed = speed;
      if (speed && !autoScrollRaf) {
        autoScrollRaf = requestAnimationFrame(tickAutoScroll);
      } else if (!speed) {
        stopAutoScroll();
      }
    }

    function removeGhost() {
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }

    function beginDrag(e) {
      const tab = drag.tab;
      const rect = tab.getBoundingClientRect();
      drag.offsetX = drag.startX - rect.left;
      drag.offsetY = drag.startY - rect.top;
      drag.active = true;
      drag.tab.classList.add('tab-drag-source');
      strip.classList.add('is-reordering');

      ghost = tab.cloneNode(true);
      ghost.classList.add('tab-drag-ghost');
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      document.body.appendChild(ghost);
      updateGhost(e.clientX, e.clientY);
      suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
    }

    function updateGhost(clientX, clientY) {
      if (!ghost || !drag) return;
      ghost.style.transform = `translate(${clientX - drag.offsetX}px, ${clientY - drag.offsetY}px)`;
    }

    function cleanupDrag() {
      stopAutoScroll();
      clearDropMarks();
      removeGhost();
      if (drag && drag.tab) drag.tab.classList.remove('tab-drag-source');
      strip.classList.remove('is-reordering');
      drag = null;
    }

    function finishDrag() {
      if (!drag || !drag.active) return;
      const fromId = drag.tab.dataset.tabId;
      const target = drag.dropTarget;
      const current = ids();
      const ordered = computeReorder(
        current,
        fromId,
        target && target.tab ? target.tab.dataset.tabId : null,
        Boolean(target && target.after)
      );
      const changed = ordered.join('\u0000') !== current.join('\u0000');
      suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
      if (changed && typeof opts.onReorder === 'function') {
        opts.onReorder(ordered, fromId);
        if (typeof opts.onAfterReorder === 'function') {
          requestAnimationFrame(() => opts.onAfterReorder(fromId));
        }
      }
    }

    function focusTab(tabId) {
      const next = tabs().find(tab => tab.dataset.tabId === tabId);
      if (!next) return;
      next.focus({ preventScroll: true });
      if (typeof next.scrollIntoView === 'function') {
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }

    function reorderByKeyboard(tab, direction) {
      const current = ids();
      const from = current.indexOf(tab.dataset.tabId);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= current.length) return;
      const ordered = current.slice();
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      const movedId = tab.dataset.tabId;
      if (typeof opts.onReorder === 'function') {
        opts.onReorder(ordered, movedId);
        requestAnimationFrame(() => focusTab(movedId));
      }
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('.project-tab-close, .project-tab-new')) return;

      const tab = e.target.closest(opts.tabSelector);
      if (tab && strip.contains(tab)) {
        drag = {
          pointerId: e.pointerId,
          tab,
          startX: e.clientX,
          startY: e.clientY,
          active: false,
          dropTarget: null
        };
        e.stopPropagation();
        return;
      }

      // Background drag pans the strip. This is the same interaction users
      // already know from responsive horizontal carousels.
      pan = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: strip.scrollLeft,
        moved: false
      };
      strip.classList.add('is-panning');
      e.preventDefault();
      e.stopPropagation();
    }

    function onPointerMove(e) {
      if (pan && e.pointerId === pan.pointerId) {
        const dx = e.clientX - pan.startX;
        if (Math.abs(dx) > PAN_THRESHOLD) {
          pan.moved = true;
          suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
          strip.scrollLeft = pan.startScroll - dx;
          e.preventDefault();
        }
        return;
      }

      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.active) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        // Vertical intent should scroll the page, not reorder a tab.
        if (Math.abs(dy) > Math.abs(dx) * 1.25) {
          drag = null;
          return;
        }
        beginDrag(e);
      }

      e.preventDefault();
      updateGhost(e.clientX, e.clientY);
      drag.dropTarget = dropTargetAt(e.clientX, drag.tab);
      markDropTarget(drag.dropTarget);
      updateAutoScroll(e.clientX);
    }

    function finishPointer(e) {
      if (pan && e.pointerId === pan.pointerId) {
        if (pan.moved) suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
        pan = null;
        strip.classList.remove('is-panning');
      }
      if (drag && e.pointerId === drag.pointerId) {
        finishDrag();
        cleanupDrag();
      }
    }

    function cancelPointer() {
      pan = null;
      strip.classList.remove('is-panning');
      cleanupDrag();
    }

    function onWheel(e) {
      const max = strip.scrollWidth - strip.clientWidth;
      if (max <= 1) return;
      const deltaY = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const deltaX = e.deltaMode === 1 ? e.deltaX * 33 : e.deltaX;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      if (!delta) return;
      strip.scrollLeft += delta;
      e.preventDefault();
      e.stopPropagation();
    }

    function onClickCapture(e) {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onKeyDown(e) {
      const tab = e.target.closest(opts.tabSelector);
      if (!tab || !strip.contains(tab)) return;
      const list = tabs();
      const index = list.indexOf(tab);

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.altKey) {
          reorderByKeyboard(tab, e.key === 'ArrowRight' ? 1 : -1);
          return;
        }
        const next = index + (e.key === 'ArrowRight' ? 1 : -1);
        if (next >= 0 && next < list.length) {
          list[next].focus({ preventScroll: true });
          list[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        if (list[0]) list[0].focus({ preventScroll: true });
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (list[list.length - 1]) list[list.length - 1].focus({ preventScroll: true });
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      }
    }

    function refresh() {
      const active = strip.querySelector(`${opts.tabSelector}.active`);
      tabs().forEach(tab => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
        // Roving tabindex: one stop in the tab list, arrows move within it.
        tab.tabIndex = active ? (tab === active ? 0 : -1) : 0;
      });
    }

    const controller = {
      options: opts,
      update(nextOptions) {
        Object.assign(opts, nextOptions || {});
        refresh();
      },
      refresh,
      destroy() {
        cancelPointer();
        strip.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finishPointer);
        window.removeEventListener('pointercancel', cancelPointer);
        window.removeEventListener('blur', cancelPointer);
        strip.removeEventListener('wheel', onWheel);
        strip.removeEventListener('click', onClickCapture, true);
        strip.removeEventListener('keydown', onKeyDown);
        delete strip.__noiradixTabStrip;
      }
    };

    strip.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('blur', cancelPointer);
    strip.addEventListener('wheel', onWheel, { passive: false });
    strip.addEventListener('click', onClickCapture, true);
    strip.addEventListener('keydown', onKeyDown);
    // Legacy header pan handlers use mousedown; keep them off the strip.
    strip.addEventListener('mousedown', e => e.stopPropagation());

    strip.classList.add('is-tab-strip-ready');
    strip.__noiradixTabStrip = controller;
    refresh();
    return controller;
  }

  const api = { attach, computeReorder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.NoiraTabStrip = api;
})(typeof window !== 'undefined' ? window : null);
