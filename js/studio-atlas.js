/** Studio atlas raster construction; UI owns options, errors and download. */
const StudioAtlas = (() => {
  const engine = typeof PIX2 !== 'undefined' ? PIX2 : require('./pix2-format.js');
  function build(doc, opts, { resolveCell, createCanvas }) {
    if (!doc) return null;
    const { spacing, margin, extrude, scale } = opts;
    const cols = doc.meta.grid.cols;
    const rows = doc.meta.grid.rows;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;

    const scw = cw * scale;
    const sch = ch * scale;

    const atlasW = margin * 2 + cols * scw + Math.max(0, cols - 1) * spacing;
    const atlasH = margin * 2 + rows * sch + Math.max(0, rows - 1) * spacing;

    engine.assertRasterSize(atlasW, atlasH);

    const canvas = createCanvas();
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, atlasW, atlasH);

    // Frame layout map for metadata
    const frameRects = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = resolveCell(doc, r, c);
        const cid = cell ? cell.id : `cell_${r}_${c}`;
        const ox = margin + c * (scw + spacing);
        const oy = margin + r * (sch + spacing);

        const frameName = (cell && cell.name) ? cell.name : `frame_${r}_${c}`;
        frameRects.push({
          id: cid,
          name: frameName,
          row: r,
          col: c,
          x: ox,
          y: oy,
          w: scw,
          h: sch,
          nativeW: cw,
          nativeH: ch
        });

        if (cell && cell.pixels) {
          // 1. Draw cell pixels
          for (const coord in cell.pixels) {
            const [px, py] = coord.split(',').map(Number);
            ctx.fillStyle = cell.pixels[coord];
            ctx.fillRect(ox + px * scale, oy + py * scale, scale, scale);
          }

          // 2. Extrude edges if enabled (1px padding bleed-protection clone)
          if (extrude && spacing > 0) {
            // Top and bottom edges
            for (let px = 0; px < cw; px++) {
              const topCol = cell.pixels[`${px},0`];
              if (topCol) {
                ctx.fillStyle = topCol;
                ctx.fillRect(ox + px * scale, oy - 1, scale, 1);
              }
              const botCol = cell.pixels[`${px},${ch - 1}`];
              if (botCol) {
                ctx.fillStyle = botCol;
                ctx.fillRect(ox + px * scale, oy + sch, scale, 1);
              }
            }
            // Left and right edges
            for (let py = 0; py < ch; py++) {
              const leftCol = cell.pixels[`0,${py}`];
              if (leftCol) {
                ctx.fillStyle = leftCol;
                ctx.fillRect(ox - 1, oy + py * scale, 1, scale);
              }
              const rightCol = cell.pixels[`${cw - 1},${py}`];
              if (rightCol) {
                ctx.fillStyle = rightCol;
                ctx.fillRect(ox + scw, oy + py * scale, 1, scale);
              }
            }
          }
        }
      }
    }

    return { canvas, width: atlasW, height: atlasH, frameRects, scale, spacing, margin };
  }

  return { build };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = StudioAtlas;
