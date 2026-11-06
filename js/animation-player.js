/**
 * PIX2 Studio - Real-Time Animation Player (4-Dir, 8-Dir, & Custom Animations)
 * Supports Onion Skinning, Ping-Pong, and Arbitrary Frame Sequences
 */

class AnimationPlayer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.timer = null;
    this.currentFrameIdx = 0;
    this.lastTimestamp = 0;
    this.pingpongForward = true;

    // 8-direction vectors and names
    this.directions8 = [
      { id: 'down', name: 'Down (S)', angle: 90, fallback4: 'down', row: 0 },
      { id: 'down_right', name: 'Down-Right (SE)', angle: 45, fallback4: 'right', row: 7 },
      { id: 'right', name: 'Right (D)', angle: 0, fallback4: 'right', row: 2 },
      { id: 'up_right', name: 'Up-Right (NE)', angle: 315, fallback4: 'right', row: 5 },
      { id: 'up', name: 'Up (W)', angle: 270, fallback4: 'up', row: 1 },
      { id: 'up_left', name: 'Up-Left (NW)', angle: 225, fallback4: 'left', row: 4 },
      { id: 'left', name: 'Left (A)', angle: 180, fallback4: 'left', row: 3 },
      { id: 'down_left', name: 'Down-Left (SW)', angle: 135, fallback4: 'left', row: 6 }
    ];

    this.directions4 = [
      { id: 'down', name: 'Down (S)', row: 0 },
      { id: 'up', name: 'Up (W)', row: 1 },
      { id: 'right', name: 'Right (D)', row: 2 },
      { id: 'left', name: 'Left (A)', row: 3 }
    ];

    this.activeAnimationName = null; // null means auto-detect via direction
    this.currentDirection = 'down';
    this.currentMode = '4dir'; // '4dir' | '8dir'
    this.fps = 6;
    this.isPlaying = true;
    this.scale = 4; // 4x preview
    this.onionSkin = false;
    this.onFrameChange = null;
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  start() {
    this.isPlaying = true;
    if (!this.timer) {
      this.lastTimestamp = performance.now();
      const loop = (timestamp) => {
        if (!this.isPlaying) return;
        const interval = 1000 / this.fps;
        const elapsed = timestamp - this.lastTimestamp;

        if (elapsed >= interval) {
          this.lastTimestamp = timestamp - (elapsed % interval);
          this.stepFrame(1);
          this.render();
          this.notifyFrameChange();
        }
        this.timer = requestAnimationFrame(loop);
      };
      this.timer = requestAnimationFrame(loop);
    }
  }

  notifyFrameChange() {
    if (typeof this.onFrameChange === 'function') {
      const frames = this.getActiveFrames();
      const cellId = (frames && frames.length > 0) ? frames[this.currentFrameIdx] : null;
      this.onFrameChange(this.currentFrameIdx, cellId);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      cancelAnimationFrame(this.timer);
      this.timer = null;
    }
  }

  stepFrame(delta = 1) {
    const frames = this.getActiveFrames();
    if (frames.length === 0) {
      this.currentFrameIdx = 0;
      return;
    }

    const anim = this.getActiveAnimationObj();
    const mode = anim ? (anim.mode || 'loop') : 'loop';

    if (mode === 'pingpong' && frames.length > 2) {
      if (this.pingpongForward) {
        if (this.currentFrameIdx + delta >= frames.length) {
          this.pingpongForward = false;
          this.currentFrameIdx = Math.max(0, frames.length - 2);
        } else {
          this.currentFrameIdx += delta;
        }
      } else {
        if (this.currentFrameIdx - delta < 0) {
          this.pingpongForward = true;
          this.currentFrameIdx = Math.min(1, frames.length - 1);
        } else {
          this.currentFrameIdx -= delta;
        }
      }
    } else {
      this.currentFrameIdx = (this.currentFrameIdx + delta + frames.length) % frames.length;
    }
    this.notifyFrameChange();
  }

  setAnimation(animName) {
    this.activeAnimationName = animName;
    this.currentFrameIdx = 0;
    this.pingpongForward = true;

    // If anim specifies fps, adopt it
    const anim = this.getActiveAnimationObj();
    if (anim && anim.fps) {
      this.fps = anim.fps;
    }
    this.render();
    this.notifyFrameChange();
  }

  setDirection(dirId) {
    this.currentDirection = dirId;
    this.activeAnimationName = null; // Auto resolve by direction
    this.currentFrameIdx = 0;
    this.render();
  }

  setMode(mode) {
    this.currentMode = mode;
    if (mode === '4dir') {
      const d8 = this.directions8.find(d => d.id === this.currentDirection);
      if (d8 && d8.fallback4) {
        this.currentDirection = d8.fallback4;
      }
    }
    this.render();
  }

  setFps(fps) {
    this.fps = Math.max(1, Math.min(30, fps));
  }

  toggleOnionSkin() {
    this.onionSkin = !this.onionSkin;
    this.render();
    return this.onionSkin;
  }

  getActiveAnimationObj() {
    if (!window.state || !window.state.doc || !window.state.doc.animations) return null;
    const anims = window.state.doc.animations;

    if (this.activeAnimationName && anims[this.activeAnimationName]) {
      return anims[this.activeAnimationName];
    }

    const possibleNames = [
      `walk_${this.currentDirection}`,
      `idle_${this.currentDirection}`,
      this.currentDirection
    ];

    for (const name of possibleNames) {
      if (anims[name] && anims[name].frames && anims[name].frames.length > 0) {
        return anims[name];
      }
    }

    // Return first available animation
    const firstKey = Object.keys(anims)[0];
    return firstKey ? anims[firstKey] : null;
  }

  getActiveFrames() {
    if (!window.state || !window.state.doc) return [];
    const doc = window.state.doc;

    // 1. If explicit animation is selected
    if (this.activeAnimationName && doc.animations && doc.animations[this.activeAnimationName]) {
      return doc.animations[this.activeAnimationName].frames || [];
    }

    // 2. Direction-based search
    const anim = this.getActiveAnimationObj();
    if (anim && anim.frames && anim.frames.length > 0) {
      return anim.frames;
    }

    // 3. Fallback: Map direction to row
    const d8 = this.directions8.find(d => d.id === this.currentDirection);
    let targetRow = 0;
    if (doc.meta.grid.rows >= 8 && d8 && d8.row < doc.meta.grid.rows) {
      targetRow = d8.row;
    } else {
      const fallbackDir = (d8 && d8.fallback4) ? d8.fallback4 : this.currentDirection;
      const d4 = this.directions4.find(d => d.id === fallbackDir);
      targetRow = (d4 && d4.row < doc.meta.grid.rows) ? d4.row : 0;
    }

    const rowCells = [];
    for (let c = 0; c < doc.meta.grid.cols; c++) {
      const cid = `cell_${targetRow}_${c}`;
      if (doc.cells[cid]) rowCells.push(cid);
    }
    return rowCells;
  }

  render() {
    if (!this.canvas || !this.ctx || !window.state || !window.state.doc) return;
    const doc = window.state.doc;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;

    this.canvas.width = cw * this.scale;
    this.canvas.height = ch * this.scale;
    this.ctx.imageSmoothingEnabled = false;

    // Draw checkerboard
    this.drawCheckerboard(this.canvas.width, this.canvas.height);

    const frames = this.getActiveFrames();
    if (frames.length === 0) return;

    // 1. Onion Skinning (Ghost previous frame)
    if (this.onionSkin && frames.length > 1) {
      const prevIdx = (this.currentFrameIdx - 1 + frames.length) % frames.length;
      const prevCell = doc.cells[frames[prevIdx]];
      if (prevCell && prevCell.pixels) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.28;
        for (const coord in prevCell.pixels) {
          const [x, y] = coord.split(',').map(Number);
          this.ctx.fillStyle = '#6366f1'; // Tinted ghost color
          this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
        }
        this.ctx.restore();
      }
    }

    // 2. Draw Active Frame
    const cellId = frames[this.currentFrameIdx % frames.length];
    const cell = doc.cells[cellId];
    if (!cell || !cell.pixels) return;

    for (const coord in cell.pixels) {
      const [x, y] = coord.split(',').map(Number);
      this.ctx.fillStyle = cell.pixels[coord];
      this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
    }
  }

  drawCheckerboard(w, h) {
    const isDark = document.body && document.body.classList.contains('dark-theme');
    const c1 = isDark ? '#1f202e' : '#ffffff';
    const c2 = isDark ? '#171822' : '#e2e8f0';
    const size = 6;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        this.ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? c1 : c2;
        this.ctx.fillRect(x, y, size, size);
      }
    }
  }
}

window.AnimationPlayer = AnimationPlayer;
