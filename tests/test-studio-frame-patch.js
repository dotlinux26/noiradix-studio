const assert = require('node:assert/strict');
const PIX2 = require('../js/pix2-format.js');
global.PIX2 = PIX2;
const StudioSource = require('../js/studio-source.js');

const baseText = `@pix2 1.1
@meta
  title: "Frame patch test"
  version: "1.1"
@grid
  cols: 2
  rows: 1
  default_cell: 16x16
@palette
  1: #333333
  2: #ff0000
@cell cell_a
  grid_pos: 0,0
@layer layer_a
  cell: cell_a
@region region_a
  cell: cell_a
  parent: layer_a
  pixel 1,1 1
@cell cell_b
  grid_pos: 0,1
@layer layer_b
  cell: cell_b
@region region_b
  cell: cell_b
  parent: layer_b
  pixel 2,2 2
@animation walk
  frames: [cell_a, cell_b]
  fps: 6
  loop: true
@end`;

const doc = PIX2.parseValidated(baseText);
const originalOtherPixel = doc.cells.cell_b.pixels['2,2'];
let autosaves = 0;
let refreshes = 0;
const fakeClassList = () => ({ add() {}, remove() {} });
const state = {
  doc,
  activeTabId: 'cell_a',
  saveSnapshot(action) {
    this.lastSnapshot = action;
    return true;
  },
  applyDocument(nextDoc, action) {
    this.doc = nextDoc;
    this.lastAction = action;
    return true;
  },
};
const dom = {
  modalImportFrameCode: { classList: fakeClassList() },
  importFrameCodeTextarea: { value: '', focus() {} },
  importFrameCodeContext: { textContent: '' },
  importFrameCodeError: { textContent: '', classList: fakeClassList() },
};
const controller = StudioSource.create({
  state,
  dom,
  view: {},
  escapeHtml: (text) => String(text),
  refreshAll: () => { refreshes++; },
  showToast: (message, type) => { state.lastToast = { message, type }; },
  triggerEventAutosave: () => { autosaves++; },
});

controller.openFrameCodeImport();
assert.match(dom.importFrameCodeContext.textContent, /cell_a/);

// The incoming fragment is a complete one-cell document. Its structural IDs
// intentionally collide with the untouched second frame and must be rekeyed.
dom.importFrameCodeTextarea.value = `@pix2 1.1
@meta
  title: "Edited frame"
  version: "1.1"
@grid
  cols: 1
  rows: 1
  default_cell: 16x16
@palette
  1: #00ff00
@cell edited_cell
  name: "Edited A"
  grid_pos: 0,0
@layer layer_b
  cell: edited_cell
  name: "Replacement layer"
@region region_b
  cell: edited_cell
  parent: layer_b
  pixel 3,4 1
@end`;

controller.applyFrameCodeImport();
assert.equal(state.lastSnapshot, 'Before Frame Import', 'frame import should capture an undo baseline');
assert.equal(state.lastAction, 'Import Frame Code');
assert.equal(autosaves, 1, 'frame import should autosave');
assert.equal(refreshes, 1, 'frame import should refresh the active editor');
assert.equal(state.doc.meta.grid.cols, 2, 'project grid size must remain unchanged');
assert.equal(state.doc.cells.cell_a.row, 0);
assert.equal(state.doc.cells.cell_a.col, 0);
assert.equal(state.doc.cells.cell_a.name, 'Edited A');
assert.equal(state.doc.cells.cell_a.pixels['3,4'], '#00ff00');
assert.equal(state.doc.cells.cell_b.pixels['2,2'], originalOtherPixel, 'untouched frame pixels must survive');
assert.deepEqual(state.doc.animations.walk.frames, ['cell_a', 'cell_b'], 'project animations must survive');
assert.notEqual(state.doc.cells.cell_a.layers[0].id, state.doc.cells.cell_b.layers[0].id,
  'incoming structure IDs must not collide with untouched cells');
assert.notEqual(state.doc.cells.cell_a.layers[0].children[0].id, state.doc.cells.cell_b.layers[0].children[0].id,
  'incoming Region IDs must not collide with untouched cells');
assert.equal(PIX2.parseValidated(PIX2.serialize(state.doc)).cells.cell_b.pixels['2,2'], originalOtherPixel,
  'serialized reload must retain untouched art');

controller.openFrameCodeImport();
dom.importFrameCodeTextarea.value = '@pix2 1.0\n@meta\n  title: "Bad"\n  version: "1.0"\n@grid\n  cols: 1\n  rows: 1\n  default_cell: 16x16\n@palette\n  1: #ffffff\n@cell a\n  pixel 1,1 1\n@end';
controller.applyFrameCodeImport();
assert.equal(autosaves, 1, `invalid patch must not mutate or autosave; toast=${JSON.stringify(state.lastToast)}`);
assert.ok(dom.importFrameCodeError.textContent, 'invalid patch should show an actionable error');

console.log('PASS frame-scoped PIX2 import preserves other cells, animations, identity, and rejects invalid input');
