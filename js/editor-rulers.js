(function (global) {
  'use strict';

  const THICKNESS = 24;

  function labelInterval(zoom) {
    return 2 ** Math.max(0, Math.ceil(Math.log2(40 / zoom)));
  }

  function sizeRuler(canvas, length, vertical, dpr) {
    const [width, height] = vertical ? [THICKNESS, length] : [length, THICKNESS];
    const backingWidth = Math.min(16384, Math.round(width * dpr));
    const backingHeight = Math.min(16384, Math.round(height * dpr));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    const cssWidth = `${width}px`;
    const cssHeight = `${height}px`;
    if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
    if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
  }

  function tickRange(count, interval, min, max) {
    return {
      start: Math.max(0, Math.floor((min - interval) / interval) * interval),
      end: Math.min(count, Math.ceil((max + interval) / interval) * interval)
    };
  }

  function paintRuler(canvas, count, zoom, vertical, dpr, dark, min = 0, max = count) {
    const length = Math.max(1, Math.round(count * zoom));
    sizeRuler(canvas, length, vertical, dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = dark ? '#141722' : '#f8fafc';
    ctx.fillRect(0, 0, vertical ? THICKNESS : length, vertical ? length : THICKNESS);
    const interval = labelInterval(zoom);
    const { start, end } = tickRange(count, interval, min, max);
    const tick = (index, depth) => {
      const pos = Math.min(length - 1, Math.floor(index * zoom)) + 0.5;
      ctx.moveTo(vertical ? depth : pos, vertical ? pos : depth);
      ctx.lineTo(vertical ? THICKNESS : pos, vertical ? pos : THICKNESS);
    };
    if (zoom >= 6) {
      ctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.18)';
      ctx.beginPath();
      for (let index = Math.max(0, min - 2); index < Math.min(count, max + 2); index++) {
        if (index % interval !== 0) tick(index, 16);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(100, 116, 139, 0.45)';
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.beginPath();
    for (let index = start; index <= end && index < count; index += interval) {
      tick(index, 10);
      const pos = Math.floor(index * zoom) + 2;
      const label = String(index);
      const extent = vertical ? 9 : ctx.measureText(label).width;
      if (pos + extent <= length) ctx.fillText(label, vertical ? 2 : pos, vertical ? pos : 2);
    }
    tick(count, 6);
    ctx.stroke();
  }

  function drawOverlay(canvas, baseline, count, zoom, vertical, dpr, hover, start, size) {
    const length = Math.max(1, Math.round(count * zoom));
    sizeRuler(canvas, length, vertical, dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(baseline, 0, 0, vertical ? THICKNESS : length, vertical ? length : THICKNESS);
    const highlight = (index, span, alpha, lineWidth) => {
      const pos = Math.floor(index * zoom);
      const extent = Math.max(1, Math.round((index + span) * zoom) - pos);
      ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
      ctx.fillRect(vertical ? 0 : pos, vertical ? pos : 0, vertical ? THICKNESS : extent, vertical ? extent : THICKNESS);
      ctx.fillStyle = '#6366f1';
      const edge = THICKNESS - lineWidth;
      ctx.fillRect(vertical ? edge : pos, vertical ? pos : edge, vertical ? lineWidth : extent, vertical ? extent : lineWidth);
    };
    if (size > 0) highlight(start, size, 0.2, 2);
    if (hover != null && hover >= 0 && hover < count) highlight(hover, 1, 0.35, 4);
  }

  const EditorRulers = { labelInterval, tickRange, sizeRuler, paintRuler, drawOverlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = EditorRulers;
  else global.EditorRulers = EditorRulers;
})(typeof globalThis !== 'undefined' ? globalThis : this);
