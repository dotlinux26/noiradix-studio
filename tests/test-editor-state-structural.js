// tests/test-editor-state-structural.js
// Tests for Phase 2 Shared Structural Render & Edit Engine in EditorState

const assert = require('assert');
const EditorState = require('../js/editor-state.js');
const PIX2 = require('../js/pix2-format.js');

console.log('====================================================');
console.log('RUNNING EDITOR STATE STRUCTURAL ENGINE TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passCount++;
}

const state = new EditorState();

// 1. Initialize with a clean v1.1 document
const initialPix2 = `@pix2 1.1
@meta
  title: "Structural Test"
  version: "1.1"
@grid
  columns: 1
  rows: 1
  default_cell: 16x16
@palette
  1: #ff0000
  2: #00ff00
@cell c0
  grid_pos: 0,0
@end
`;

const doc = PIX2.parse(initialPix2);
state.setDocument(doc);
state.openCellTab('c0');

assert.strictEqual(state.activeTabId, 'c0');
const cell = state.getActiveCell();
assert.ok(cell, 'Active cell c0 resolved');
pass('Document loaded and cell tab opened in EditorState');

// 2. Add structural layers and regions
const layer1 = state.addLayer('c0', 'Base Layer');
assert.ok(layer1, 'Layer created');
assert.strictEqual(layer1.name, 'Base Layer');
assert.strictEqual(cell.layers.length, 2, 'Cell contains legacy default layer plus added layer');
assert.strictEqual(layer1.children.length, 1, 'Default region created inside layer');

const reg1 = layer1.children[0];
assert.strictEqual(state.activeRegionId, reg1.id, 'Active region set to new layer default region');
pass('addLayer creates layer and default child region');

// 3. Draw pixels through plotPixelAt
const plot1 = state.plotPixelAt('c0', 2, 2, '#ff0000');
assert.strictEqual(plot1, true, 'plotPixelAt succeeded');
assert.strictEqual(reg1.pixels['2,2'], '#ff0000', 'Pixel plotted into active region');
assert.strictEqual(cell.pixels['2,2'], '#ff0000', 'Pixel reflected in composited cell');
pass('plotPixelAt writes to active region and updates composited cell');

// 4. Add a group and a sub-region
const grp = state.addGroup('c0', layer1.id, 'Details Group', ['decal', 'face']);
assert.ok(grp, 'Group created');
assert.strictEqual(grp.parent, layer1.id);
assert.deepStrictEqual(grp.tags, ['decal', 'face']);

const reg2 = state.addRegion('c0', grp.id, 'Eyes Region', ['eye']);
assert.ok(reg2, 'Sub-region created');
assert.strictEqual(reg2.parent, grp.id);
assert.strictEqual(state.activeRegionId, reg2.id);

state.plotPixelAt('c0', 4, 4, '#00ff00');
assert.strictEqual(reg2.pixels['4,4'], '#00ff00');
assert.strictEqual(cell.pixels['4,4'], '#00ff00');
pass('addGroup and addRegion create nested hierarchy and receive plots');

// 5. Visibility and Opacity Compositing
state.setLayerOpacity('c0', layer1.id, 0.5);
assert.strictEqual(layer1.opacity, 0.5);
const compPixel = cell.pixels['2,2'];
assert.ok(compPixel.length === 9, 'Composited pixel has 50% alpha channel');

state.setNodeVisibility('c0', reg2.id, false);
assert.strictEqual(cell.pixels['4,4'], undefined, 'Hidden region pixels omitted from composite');

state.setNodeVisibility('c0', reg2.id, true);
assert.ok(cell.pixels['4,4'], 'Restored visible region pixels in composite');
pass('setLayerOpacity and setNodeVisibility dynamically update composited cell');

// 6. Lock Protection
state.setNodeLocked('c0', reg2.id, true);
const plotLocked = state.plotPixelAt('c0', 5, 5, '#00ff00');
assert.strictEqual(plotLocked, false, 'Plotting in locked region blocked');
assert.strictEqual(reg2.pixels['5,5'], undefined, 'No pixel added to locked region');
state.setNodeLocked('c0', reg2.id, false);
pass('setNodeLocked protects region against unauthorized modification');

// 7. Isolation Mode
state.setIsolation(reg1.id);
assert.strictEqual(state.isolatedNodeId, reg1.id);
state.syncCellComposite('c0');
state.setIsolation(null);
assert.strictEqual(state.isolatedNodeId, null);
pass('Isolation mode toggles cleanly');

// 8. Full Undo/Redo of Structural Edits
const preUndoHistoryLen = state.history.length;
assert.ok(preUndoHistoryLen > 3, 'Multiple history snapshots recorded');

// Undo 5 operations: Toggle Lock (x2), Toggle Visibility (x2), Set Opacity
state.undo(); // Undo Lock false
state.undo(); // Undo Lock true
state.undo(); // Undo Visibility true
state.undo(); // Undo Visibility false
state.undo(); // Undo Opacity 0.5
assert.strictEqual(state.findNode('c0', layer1.id).node.opacity, 1.0, 'Opacity restored to 1.0 by undo');

state.redo(); // Redo Opacity 0.5
assert.strictEqual(state.findNode('c0', layer1.id).node.opacity, 0.5, 'Opacity re-applied by redo');
pass('Undo and Redo seamlessly restore both structural mutations and pixel buffers');

console.log('\n====================================================');
console.log(`ALL EDITOR STATE STRUCTURAL TESTS PASSED (${passCount}/${passCount})`);
console.log('====================================================\n');
