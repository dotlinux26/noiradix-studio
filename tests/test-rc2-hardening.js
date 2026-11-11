const assert = require('node:assert/strict');
const PIX2 = require('../js/pix2-format.js');
const ImportSlice = require('../js/import-slice.js');
const ModularExport = require('../js/modular-export.js');
const FileSave = require('../js/editor-file-save.js');

(async () => {
  const labels = ['A; B', 'Mage "#face"', "King's #face", 'literal \\n and \\r', 'Backslash \\"; #beef', 'Mắt trái "đỏ"; #face'];
  for (const label of labels) {
    const doc = PIX2.createDocument(label, 1, 1, 4, 4);
    const region = doc.cells.cell_0_0.layers[0].children[0];
    region.name = label;
    region.pixels['1,1'] = '#12345680';
    const result = PIX2.parse(PIX2.serialize(doc));
    assert.equal(result.meta.title, label);
    assert.equal(result.cells.cell_0_0.layers[0].children[0].name, label);
    assert.deepEqual(result.cells.cell_0_0.pixels, { '1,1': '#12345680' });
  }
  assert.equal(PIX2.stripComment('name: "a; b \\"#face\\"" # comment'), 'name: "a; b \\"#face\\""');
  assert.equal(PIX2.stripComment('name: "King\'s; crown" ; comment'), 'name: "King\'s; crown"');
  console.log('PASS quoted UTF-8 names, escapes, semicolons, apostrophes and hex comments roundtrip');

  const header = '@pix2 1.0\n@grid\n cols: 1\n rows: 1\n default_cell: 4x4\n';
  const limitedGrid = PIX2.parse(header.replace('cols: 1', 'cols: 17'), { profile: 'pixelart' });
  assert.equal(limitedGrid.meta.grid.cols, 16);
  assert.equal(PIX2.validate(limitedGrid, { profile: 'pixelart', strict: true }).valid, false);
  const frames = Array.from({ length: 65 }, () => 'c').join(',');
  const anim = PIX2.parse(header + '@cell c\n@animation walk\n fps: 120\n frames: [' + frames + ']\n', { profile: 'pixelart' });
  assert.equal(anim.animations.walk.fps, 60);
  assert.equal(anim.animations.walk.frames.length, 64);
  const cells = PIX2.parse(header + Array.from({ length: 257 }, (_, i) => '@cell c' + i + '\n').join(''), { profile: 'pixelart' });
  assert.equal(Object.keys(cells.cells).length, 256);
  assert.ok(cells._diagnostics.some(item => item.code === 'PIX2_ERR_RESOURCE_LIMIT'));
  assert.throws(() => PIX2.parse('@pix2 1.0\n# ĐĐĐĐĐĐ', { maxFileSize: 22 }), /file size/);
  assert.throws(() => PIX2.parse(header + '@cell c\nrect 0,0 4x4 #ffffff fill\n', { maxRasterOperations: 4 }), /raster work limit/);
  const nodes = '@pix2 1.1\n@cell c\n@layer l\n' + Array.from({ length: 4096 }, (_, i) =>
    '@region r' + i + '\n cell: c\n parent: l\n').join('');
  assert.throws(() => PIX2.parse(nodes, { profile: 'pixelart' }), /structural node limit/);
  console.log('PASS profile grid/cell/animation bounds, UTF-8 size, structural and raster work budgets');

  const big = PIX2.parse('@pix2 1.0\n@grid\n cols: 1\n rows: 1\n default_cell: 1024x1024\n@cell c\nrect 0,0 1024x1024 #123456 fill\n', { profile: 'pixelart' });
  assert.equal(Object.keys(big.cells.c.pixels).length, 1048576);
  assert.equal(big.cells.c.pixels['1023,1023'], '#123456');
  const clipped = PIX2.parse(header + '@cell c\nrect -1,-1 999999999x999999999 #ffffff outline\n');
  assert.deepEqual(clipped.cells.c.pixels, {});
  const clippedFill = PIX2.parse(header + '@cell c\nrect -1,-1 999999999x999999999 #ffffff fill\n');
  assert.equal(Object.keys(clippedFill.cells.c.pixels).length, 16);
  assert.throws(() => ImportSlice.sliceAlphaIslands(() => ({ a: 0 }), 1e9, 1e9), /allocation limit/);
  assert.throws(() => ImportSlice.extractFramePixels(() => ({ a: 0 }), { frame: { x: 0, y: 0, w: Infinity, h: 1 } }), /allocation limit/);
  const unsafeExport = PIX2.createDocument('Unsafe export', 1, 1, 4, 4);
  unsafeExport.meta.cellSize = { w: 8192, h: 8192 };
  assert.throws(() => ModularExport.exportModularComponents(unsafeExport, { mode: 'composite' }), /allocation limit/);
  console.log('PASS full 1024² rectangle, geometry-preserving clipping and guarded raster allocations');

  const enqueue = FileSave.createQueue();
  const writes = [];
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const handle = { async createWritable() {
    return {
      async write(value) { if (value === 'first') await wait; writes.push(value); },
      async close() {},
      async abort() {}
    };
  } };
  const first = enqueue(() => FileSave.write(handle, 'first'));
  const second = enqueue(() => FileSave.write(handle, 'second'));
  assert.deepEqual(writes, []);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(writes, ['first', 'second']);
  let aborted = false;
  const broken = { async createWritable() { return {
    async write() { throw new Error('write failed'); },
    async abort() { aborted = true; }
  }; } };
  await assert.rejects(enqueue(() => FileSave.write(broken, 'bad')), /write failed/);
  assert.equal(aborted, true);
  await enqueue(() => FileSave.write(handle, 'after failure'));
  assert.equal(writes.at(-1), 'after failure');
  assert.equal(await FileSave.permission({ async queryPermission() { return 'denied'; } }), false);
  console.log('PASS production write queue, stream abort, recovery after failure and denied permission');
})().catch(error => { console.error(error); process.exitCode = 1; });
