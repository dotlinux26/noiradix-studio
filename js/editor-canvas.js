const EditorCanvas = (() => {
  let checkerKey;
  let checkerPattern;

  function checker(ctx, zoom, dark) {
    const tile = zoom >= 4 ? Math.round(zoom) : zoom <= 1 ? 16 : Math.round(8 * zoom);
    const key = `${tile}/${dark}`;
    if (checkerKey === key && checkerPattern) return checkerPattern;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = tile * 2;
    const pattern = canvas.getContext('2d');
    pattern.fillStyle = dark ? '#1a1d29' : '#ffffff';
    pattern.fillRect(0, 0, canvas.width, canvas.height);
    pattern.fillStyle = dark ? '#121520' : '#e2e8f0';
    pattern.fillRect(0, 0, tile, tile);
    pattern.fillRect(tile, tile, tile, tile);
    checkerPattern = ctx.createPattern(canvas, 'repeat');
    checkerKey = key;
    return checkerPattern;
  }

  function drawPixels(ctx, pixels, w, h) {
    for (const key in pixels) {
      const comma = key.indexOf(',');
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      if (comma < 0 || x < 0 || x >= w || y < 0 || y >= h || !pixels[key]) continue;
      ctx.fillStyle = pixels[key];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function writePixel(ctx, x, y, color) {
    if (!color || color.length === 9 || color.length === 5) ctx.clearRect(x, y, 1, 1);
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function updateComposite(compiler, cell, size, coordinates, isolatedNodeId) {
    if (!cell.layers?.length) return cell.pixels;
    const composite = compiler.compositeCellLayers(cell, size, { coordinates });
    for (const key of coordinates) {
      if (composite[key]) cell.pixels[key] = composite[key];
      else delete cell.pixels[key];
    }
    return isolatedNodeId
      ? compiler.compositeCellLayers(cell, size, { coordinates, isolatedNodeId, dimNonIsolated: 0 })
      : composite;
  }

  function visibleBounds(canvas, viewport, w, h, zoom) {
    const full = { minX: 0, maxX: w, minY: 0, maxY: h };
    if (!canvas || !viewport || zoom <= 2) return full;
    const image = canvas.getBoundingClientRect();
    const clip = viewport.getBoundingClientRect();
    if (!image.width || !image.height || !clip.width || !clip.height) return full;
    const pad = 300;
    return {
      minX: Math.max(0, Math.floor((clip.left - image.left - pad) / zoom)),
      minY: Math.max(0, Math.floor((clip.top - image.top - pad) / zoom)),
      maxX: Math.min(w, Math.ceil((clip.right - image.left + pad) / zoom)),
      maxY: Math.min(h, Math.ceil((clip.bottom - image.top + pad) / zoom))
    };
  }

  function artworkSlice(bounds, w, h, zoom) {
    const { minX, maxX, minY, maxY } = bounds;
    const sourceW = Math.min(w - minX, maxX - minX + 1);
    const sourceH = Math.min(h - minY, maxY - minY + 1);
    const x = Math.floor(minX * zoom);
    const y = Math.floor(minY * zoom);
    const width = Math.round((minX + sourceW) * zoom) - x;
    const height = Math.round((minY + sourceH) * zoom) - y;
    return { minX, minY, sourceW, sourceH, x, y, width, height };
  }

  function resize(canvas, width, height) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  function wheelAnchor(rect, clientX, clientY, pixelX, pixelY, zoom) {
    return {
      dx: Math.round(clientX - rect.left - pixelX * zoom),
      dy: Math.round(clientY - rect.top - pixelY * zoom)
    };
  }

  function paintArtwork(ctx, canvas, slice, background) {
    const { minX, minY, sourceW, sourceH, x, y, width, height } = slice;
    if (width <= 0 || height <= 0 || sourceW <= 0 || sourceH <= 0) return;
    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
    if (canvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, minX, minY, sourceW, sourceH, x, y, width, height);
    }
  }

  return { checker, drawPixels, writePixel, updateComposite, visibleBounds, artworkSlice, paintArtwork, resize, wheelAnchor };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = EditorCanvas;
