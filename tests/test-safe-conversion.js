/**
 * SAFE-01 production regression suite.
 * Exercises the real PIX2 upgrader and EditorState transaction using a
 * multi-cell v1.0 fixture with RGBA pixels and explicit animation references.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const PIX2 = require('../js/pix2-format.js');
const EditorState = require('../js/editor-state.js');

const fixturePath = path.join(__dirname, 'fixtures', 'safe01_v10_multicell_alpha_clip.pix2');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');

function parseFixture() {
  return PIX2.parse(fixtureText, { profile: 'studio' });
}

function compositeSnapshot(doc) {
  const result = {};
  for (const cellId of Object.keys(doc.cells)) {
    const cell = doc.cells[cellId];
    result[cellId] = cell.layers
      ? { ...PIX2.compositeCellLayers(cell, doc.meta.cell_size || doc.meta.cellSize) }
      : { ...(cell.pixels || {}) };
  }
  return result;
}

console.log('====================================================');
console.log('RUNNING SAFE-01 LOSSLESS CONVERSION SUITE');
console.log('====================================================\n');

// 1. Core conversion preserves the source and every semantic field.
{
  const source = parseFixture();
  const sourceTextBefore = PIX2.serialize(source);
  const sourceComposite = compositeSnapshot(source);
  const sourcePalette = JSON.parse(JSON.stringify(source.palette));
  const sourceGrid = JSON.parse(JSON.stringify(source.meta.grid));
  const sourceAnimations = JSON.parse(JSON.stringify(source.animations));

  const result = PIX2.upgradeV10ToV11(source, { profile: 'studio' });
  assert.strictEqual(result.success, true, result.error);
  assert.deepStrictEqual(result.convertedCellIds, ['idle_custom', 'attack_custom']);
  assert.strictEqual(PIX2.serialize(source), sourceTextBefore, 'Upgrade must not mutate the source document');
  assert.strictEqual(result.doc.meta.version, '1.1');
  assert.deepStrictEqual(result.doc.palette, sourcePalette, 'Palette must remain identical');
  assert.deepStrictEqual(result.doc.meta.grid, sourceGrid, 'Grid metadata must remain identical');
  assert.deepStrictEqual(result.doc.animations, sourceAnimations, 'Animation IDs, refs, FPS and mode must remain identical');

  for (const cellId of result.convertedCellIds) {
    const cell = result.doc.cells[cellId];
    assert.strictEqual(cell.layers[0].id, `layer_legacy_${cellId}`);
    assert.strictEqual(cell.layers[0].children[0].id, `region_legacy_${cellId}`);
    assert.deepStrictEqual(
      PIX2.compositeCellLayers(cell, result.doc.meta.cell_size || result.doc.meta.cellSize),
      sourceComposite[cellId],
      `Cell ${cellId} composite must be pixel/RGBA identical`
    );
  }
  console.log('  [PASS] production upgrader preserves source, IDs, palette, grid, clips and RGBA composites');

  // Save/reload and canonical second serialization.
  const saved = PIX2.serialize(result.doc);
  const reopened = PIX2.parse(saved, { profile: 'studio' });
  const savedAgain = PIX2.serialize(reopened);
  assert.strictEqual(savedAgain, saved, 'v1.1 save/reload must be byte-deterministic');
  assert.deepStrictEqual(compositeSnapshot(reopened), sourceComposite, 'Reloaded composites must match v1.0 source');
  assert.deepStrictEqual(reopened.animations, sourceAnimations, 'Reloaded clips must retain references and timing');
  console.log('  [PASS] converted save/reload is canonical and retains all composites and clip metadata');
}

// 2. Editor transaction creates exactly one undoable action.
{
  const state = new EditorState();
  state.setDocument(parseFixture());
  state.openCellTab('attack_custom');
  const historyBefore = state.history.length;
  const result = state.upgradeDocumentToV11('attack_custom', { profile: 'studio' });
  assert.strictEqual(result.success, true, result.error);
  assert.strictEqual(result.historyEntriesAdded, 1, 'Conversion must add exactly one history entry');
  assert.strictEqual(state.history.length, historyBefore + 1);
  assert.strictEqual(state.doc.meta.version, '1.1');
  assert.strictEqual(state.activeLayerId, 'layer_legacy_attack_custom');
  assert.strictEqual(state.activeRegionId, 'region_legacy_attack_custom');

  assert.strictEqual(state.undo(), true);
  assert.strictEqual(state.doc.meta.version, '1.0', 'Undo restores the flat source document');
  assert.strictEqual(state.doc.cells.attack_custom.layers, undefined);
  assert.strictEqual(state.doc.cells.attack_custom.pixels['5,4'], '#12345678');

  assert.strictEqual(state.redo(), true);
  assert.strictEqual(state.doc.meta.version, '1.1', 'Redo reapplies the structural document');
  assert.strictEqual(state.doc.cells.attack_custom.layers[0].children[0].pixels['5,4'], '#12345678');
  console.log('  [PASS] Studio conversion transaction is one-step undoable and redoable');
}

// 3. Invalid input must leave document, focus and history untouched.
{
  const state = new EditorState();
  state.setDocument(parseFixture());
  state.openCellTab('idle_custom');
  const malformed = JSON.parse(JSON.stringify(state.doc));
  malformed.cells.idle_custom.pixels['1,1'] = 'not-a-color';
  state.doc = malformed;
  state.activeLayerId = 'sentinel-layer';
  state.activeRegionId = 'sentinel-region';
  const historyBefore = state.history.slice();
  const indexBefore = state.historyIndex;

  const result = state.upgradeDocumentToV11('idle_custom', { profile: 'studio' });
  assert.strictEqual(result.success, false, 'Malformed source must be rejected');
  assert.strictEqual(state.doc, malformed, 'Failed conversion must preserve the original document object');
  assert.deepStrictEqual(state.history, historyBefore, 'Failed conversion must not change history');
  assert.strictEqual(state.historyIndex, indexBefore);
  assert.strictEqual(state.activeLayerId, 'sentinel-layer');
  assert.strictEqual(state.activeRegionId, 'sentinel-region');
  console.log('  [PASS] failed conversion preserves document, focus and history without partial mutation');
}

console.log('\n====================================================');
console.log('ALL SAFE-01 CONVERSION TESTS PASSED (3/3)');
console.log('====================================================\n');
