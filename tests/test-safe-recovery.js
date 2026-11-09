/** SAFE-02/SAFE-05 full-document autosave and recovery regressions. */
const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const PixelArt = require('../pixelart/js/pixelart-app.js');

function makeHiddenOnlyDocument() {
  return {
    meta: {
      version: '1.1', title: 'Hidden Recovery',
      grid: { cols: 1, rows: 1 }, cell_size: { w: 4, h: 4 }
    },
    palette: { 1: '#12345678' }, animations: {},
    cells: {
      artwork: {
        id: 'artwork', name: 'Hidden Recovery', size: { w: 4, h: 4 }, pixels: {},
        layers: [{
          type: 'layer', id: 'hidden_layer', cell: 'artwork', name: 'Hidden',
          visible: false, locked: false, opacity: 1, blend: 'normal', children: [{
            type: 'region', id: 'hidden_region', cell: 'artwork', parent: 'hidden_layer',
            name: 'Hidden Region', tags: [], visible: true, locked: false,
            pixels: { '1,1': '#12345678' }, primitives: []
          }]
        }]
      }
    }
  };
}

console.log('====================================================');
console.log('RUNNING SAFE RECOVERY SUITE');
console.log('====================================================\n');

// A hidden-only structured document has an empty composite but is not empty.
{
  PixelArt.state.doc = makeHiddenOnlyDocument();
  PixelArt.state.w = 4;
  PixelArt.state.h = 4;
  PixelArt.state.title = 'Hidden Recovery';
  PixelArt.state.activeLayerId = 'hidden_layer';
  PixelArt.state.activeRegionId = 'hidden_region';
  const payload = PixelArt.createRecoveryPayload();
  assert.ok(payload.documentSource.includes('@pix2 1.1'));
  assert.deepStrictEqual(payload.pixels, {});
  assert.strictEqual(PixelArt.recoveryPayloadHasDocument(payload), true);
  console.log('  [PASS] hidden-only artwork is recognized as a full document despite an empty composite');

  const decoded = PixelArt.decodeRecoveryPayload(payload);
  const layer = decoded.doc.cells.artwork.layers[0];
  assert.strictEqual(layer.visible, false);
  assert.strictEqual(layer.children[0].pixels['1,1'], '#12345678');
  layer.visible = true;
  assert.strictEqual(PIX2.compositeCellLayers(decoded.doc.cells.artwork, { w: 4, h: 4 })['1,1'], '#12345678');
  console.log('  [PASS] full-document decode preserves hidden AST payload and show restores exact RGBA');

  const installed = PixelArt.installRecoveryPayload(payload);
  assert.ok(installed && !installed.legacy);
  assert.strictEqual(PixelArt.state.activeLayerId, 'hidden_layer');
  assert.strictEqual(PixelArt.state.activeRegionId, 'hidden_region');
  assert.strictEqual(PixelArt.state.history.length, 1);
  assert.ok(PixelArt.state.history[0].structuralLayers);
  console.log('  [PASS] recovery installation restores structural focus and seeds a structural history baseline');
}

// Old v2 payloads remain recoverable without inventing a layer tree.
{
  const legacy = PixelArt.decodeRecoveryPayload({
    w: 2, h: 3, title: 'Legacy Recovery', pixels: { '0,1': '#abcdef80' }
  });
  assert.strictEqual(legacy.legacy, true);
  assert.strictEqual(legacy.doc.cells.artwork.pixels['0,1'], '#abcdef80');
  assert.strictEqual(legacy.doc.cells.artwork.layers, undefined);
  console.log('  [PASS] legacy pixel-only autosaves remain backward compatible');
}

assert.throws(
  () => PixelArt.decodeRecoveryPayload({ documentSource: '@pix2 1.1\n@meta\n' }),
  /Recovery document|invalid|missing/i
);
console.log('  [PASS] malformed full-document recovery payload is rejected transactionally');

console.log('\n====================================================');
console.log('ALL SAFE RECOVERY TESTS PASSED (5/5)');
console.log('====================================================\n');
