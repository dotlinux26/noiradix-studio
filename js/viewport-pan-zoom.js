/**
 * NOIRADIX Shared Viewport Pan & Zoom Controller (NoiraViewport)
 *
 * Provides mathematically rigorous, anchor-centered zoom and smooth 360° panning.
 * Zero external dependencies. Reusable across:
 *  - Grid Overview (.grid-canvas-viewport)
 *  - Cell Canvas Viewport (#canvas-viewport)
 *  - Import & Slice Viewport (#import-slice-viewport-container)
 *  - Animation Studio Viewport (.anim-studio-viewport)
 *  - PixelArt Viewport (#pa-canvas-viewport)
 *
 * Invariants:
 *  - Cursor anchor invariance: pixel under pointer stays stationary during wheel zoom.
 *  - Smooth pan via Space+Drag, Middle-click (Button 1), Hand tool, or empty background drag.
 *  - Sub-pixel boundary compensation and High-DPI support.
 */

(function (global) {
  'use strict';

  const DEFAULT_ZOOM_LADDER = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

  /**
   * Pure anchor-centered zoom formula (exported for Node testing)
   * Calculates the delta pan required to keep pixel (unscaledX, unscaledY) stationary.
   */
  function computeAnchorZoomPan(oldPanX, oldPanY, oldZoom, newZoom, unscaledX, unscaledY, contentW, contentH) {
    const deltaW = ((contentW || 0) * (newZoom - oldZoom)) / 2;
    const deltaH = ((contentH || 0) * (newZoom - oldZoom)) / 2;
    const pixelShiftX = unscaledX * (newZoom - oldZoom);
    const pixelShiftY = unscaledY * (newZoom - oldZoom);

    const newPanX = Math.round(oldPanX + (deltaW - pixelShiftX));
    const newPanY = Math.round(oldPanY + (deltaH - pixelShiftY));
    return { panX: newPanX, panY: newPanY };
  }

  /**
   * Pure center-in-viewport calculation
   */
  function computeCenterPan(viewportW, viewportH, contentW, contentH, zoom) {
    const scaledW = (contentW || 0) * (zoom || 1);
    const scaledH = (contentH || 0) * (zoom || 1);
    return {
      panX: Math.round((viewportW - scaledW) / 2),
      panY: Math.round((viewportH - scaledH) / 2)
    };
  }

  /**
   * Pure fit-to-viewport calculation
   */
  function computeFitZoom(viewportW, viewportH, contentW, contentH, zoomLadder = DEFAULT_ZOOM_LADDER, padding = 40) {
    const availW = Math.max(10, viewportW - padding);
    const availH = Math.max(10, viewportH - padding);
    if (!contentW || !contentH) return zoomLadder[0];

    const scale = Math.min(availW / contentW, availH / contentH);
    let best = zoomLadder[0];
    for (const z of zoomLadder) {
      if (z <= scale) {
        best = z;
      } else {
        break;
      }
    }
    return best;
  }

  class ViewportController {
    constructor(viewport, content, options = {}) {
      this.viewport = viewport;
      this.content = content;
      this.options = Object.assign({
        defaultZoom: 4,
        minZoom: 1,
        maxZoom: 64,
        zoomLadder: DEFAULT_ZOOM_LADDER,
        enableWheelZoom: true,
        enableSpacePan: true,
        enableMiddlePan: true,
        enableBackgroundPan: true,
        isPanToolActive: null,
        onTransform: null,
        onZoomChange: null,
        onPanChange: null
      }, options);

      this.zoom = this.options.defaultZoom;
      this.panX = 0;
      this.panY = 0;
      this.isPanning = false;
      this.isSpacePressed = false;

      this._dragStartX = 0;
      this._dragStartY = 0;
      this._dragStartPanX = 0;
      this._dragStartPanY = 0;

      this._boundKeyDown = this._onKeyDown.bind(this);
      this._boundKeyUp = this._onKeyUp.bind(this);
      this._boundPointerDown = this._onPointerDown.bind(this);
      this._boundPointerMove = this._onPointerMove.bind(this);
      this._boundPointerUp = this._onPointerUp.bind(this);
      this._boundWheel = this._onWheel.bind(this);

      this._initListeners();
    }

    _initListeners() {
      if (typeof window === 'undefined') return;

      window.addEventListener('keydown', this._boundKeyDown);
      window.addEventListener('keyup', this._boundKeyUp);

      if (this.viewport) {
        this.viewport.addEventListener('pointerdown', this._boundPointerDown);
        if (this.options.enableWheelZoom) {
          this.viewport.addEventListener('wheel', this._boundWheel, { passive: false });
        }
      }

      window.addEventListener('pointermove', this._boundPointerMove);
      window.addEventListener('pointerup', this._boundPointerUp);
      window.addEventListener('pointercancel', this._boundPointerUp);
    }

    _onKeyDown(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        if (this.viewport && !this.isPanning) {
          this.viewport.classList.add('space-held');
          this.viewport.style.cursor = 'grab';
        }
      }
    }

    _onKeyUp(e) {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (this.viewport) {
          this.viewport.classList.remove('space-held');
          if (!this.isPanning) {
            this.viewport.style.cursor = '';
          }
        }
      }
    }

    _isPanTrigger(e) {
      if (e.button === 1 && this.options.enableMiddlePan) return true;
      if (this.isSpacePressed && this.options.enableSpacePan && e.button === 0) return true;
      if (typeof this.options.isPanToolActive === 'function' && this.options.isPanToolActive() && e.button === 0) return true;
      if (this.options.enableBackgroundPan && e.button === 0 && e.target === this.viewport) return true;
      return false;
    }

    _onPointerDown(e) {
      if (this._isPanTrigger(e)) {
        this.isPanning = true;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this._dragStartPanX = this.panX;
        this._dragStartPanY = this.panY;
        if (this.viewport) {
          this.viewport.classList.add('is-panning');
          this.viewport.style.cursor = 'grabbing';
        }
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
      }
    }

    _onPointerMove(e) {
      if (!this.isPanning) return;
      const dx = e.clientX - this._dragStartX;
      const dy = e.clientY - this._dragStartY;
      this.panX = Math.round(this._dragStartPanX + dx);
      this.panY = Math.round(this._dragStartPanY + dy);
      this._notifyTransform();
    }

    _onPointerUp() {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.viewport) {
          this.viewport.classList.remove('is-panning');
          this.viewport.style.cursor = this.isSpacePressed ? 'grab' : '';
        }
        document.body.style.cursor = '';
        if (typeof this.options.onPanChange === 'function') {
          this.options.onPanChange(this.panX, this.panY);
        }
      }
    }

    _onWheel(e) {
      e.preventDefault();
      const zoomIn = e.deltaY < 0;
      this.stepZoom(zoomIn ? 1 : -1, e.clientX, e.clientY);
    }

    stepZoom(direction, clientX, clientY) {
      const ladder = this.options.zoomLadder;
      const cur = this.zoom;
      let target;
      if (direction > 0) {
        target = ladder.find(z => z > cur) || this.options.maxZoom;
      } else {
        target = [...ladder].reverse().find(z => z < cur) || this.options.minZoom;
      }
      this.setZoom(target, clientX, clientY);
    }

    setZoom(newZoom, clientX, clientY, contentW, contentH) {
      const clamped = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, newZoom));
      if (clamped === this.zoom) return;

      const oldZoom = this.zoom;
      this.zoom = clamped;

      // Anchor-centered compensation if client coordinates provided
      if (clientX !== undefined && clientY !== undefined && this.content) {
        const rect = this.content.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const mx = clientX - rect.left;
          const my = clientY - rect.top;
          const unscaledX = mx / oldZoom;
          const unscaledY = my / oldZoom;

          const cw = contentW || (rect.width / oldZoom);
          const ch = contentH || (rect.height / oldZoom);

          const { panX, panY } = computeAnchorZoomPan(this.panX, this.panY, oldZoom, clamped, unscaledX, unscaledY, cw, ch);
          this.panX = panX;
          this.panY = panY;
        }
      }

      if (typeof this.options.onZoomChange === 'function') {
        this.options.onZoomChange(this.zoom);
      }
      this._notifyTransform();
    }

    setPan(x, y) {
      this.panX = Math.round(x);
      this.panY = Math.round(y);
      this._notifyTransform();
    }

    center(contentW, contentH) {
      if (!this.viewport) return;
      const vpW = this.viewport.clientWidth;
      const vpH = this.viewport.clientHeight;
      const { panX, panY } = computeCenterPan(vpW, vpH, contentW, contentH, this.zoom);
      this.panX = panX;
      this.panY = panY;
      this._notifyTransform();
    }

    fit(contentW, contentH, padding = 40) {
      if (!this.viewport) return;
      const vpW = this.viewport.clientWidth;
      const vpH = this.viewport.clientHeight;
      const fitZ = computeFitZoom(vpW, vpH, contentW, contentH, this.options.zoomLadder, padding);
      this.zoom = fitZ;
      if (typeof this.options.onZoomChange === 'function') {
        this.options.onZoomChange(this.zoom);
      }
      this.center(contentW, contentH);
    }

    reset() {
      this.zoom = this.options.defaultZoom;
      this.panX = 0;
      this.panY = 0;
      if (typeof this.options.onZoomChange === 'function') {
        this.options.onZoomChange(this.zoom);
      }
      this._notifyTransform();
    }

    _notifyTransform() {
      if (typeof this.options.onTransform === 'function') {
        this.options.onTransform(this.panX, this.panY, this.zoom);
      }
    }

    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        window.removeEventListener('pointermove', this._boundPointerMove);
        window.removeEventListener('pointerup', this._boundPointerUp);
        window.removeEventListener('pointercancel', this._boundPointerUp);
      }
      if (this.viewport) {
        this.viewport.removeEventListener('pointerdown', this._boundPointerDown);
        this.viewport.removeEventListener('wheel', this._boundWheel);
      }
    }
  }

  function attach(viewport, content, options) {
    if (!viewport) return null;
    return new ViewportController(viewport, content, options);
  }

  const NoiraViewport = {
    DEFAULT_ZOOM_LADDER,
    computeAnchorZoomPan,
    computeCenterPan,
    computeFitZoom,
    attach
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoiraViewport;
  } else {
    global.NoiraViewport = NoiraViewport;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
