const assert = require('node:assert/strict');
const Tools = require('../js/tools.js');
const App = require('../pixelart/js/pixelart-app.js');
const Presets = require('../js/editor-palette-presets.js');

// Shared raster commands clip and deduplicate, and explicitly report no-op.
const target = { pixels: { '0,0': '#ff0000' } };
const edit = Tools.editRaster(target, { w: 2, h: 2, color: '#00ff00', recordDiff: true }, plot => {
  for (const point of [[0, 0], [0, 0], [1, 1], [-1, 0], [2, 0], [0.5, 0], [NaN, 1]]) plot(...point);
});
assert.deepEqual([...edit.keys], ['0,0', '1,1']);
assert.deepEqual(edit.diff['0,0'], ['#ff0000', '#00ff00']);
assert.deepEqual(edit.bounds, { minX: 0, minY: 0, maxX: 1, maxY: 1 });
assert.equal(Tools.editRaster(target, { w: 2, h: 2, color: '#00ff00' }, plot => plot(0, 0)).keys.size, 0);
assert.equal(Tools.editRaster(target, { w: 2, h: 2, color: null }, plot => plot(0, 0)).keys.size, 1);
assert.equal(target.pixels['0,0'], undefined);
assert.equal(Tools.editRaster(null, { w: 2, h: 2, color: '#fff' }, () => { throw Error('No target'); }).keys.size, 0);

// No-op history publication must preserve dirty state AND the redo branch.
App.createNewDocument(8, 8, 'No-op history');
App.getArtworkCell().pixels['1,1'] = '#ff0000';
App.pushHistory();
App.undo();
App.markDocumentSaved();
const historyLength = App.state.history.length;
const historyIndex = App.state.historyIndex;
App.pushHistory();
assert.equal(App.state.isDirty, false);
assert.equal(App.state.history.length, historyLength);
assert.equal(App.state.historyIndex, historyIndex);
App.redo();
assert.equal(App.getArtworkCell().pixels['1,1'], '#ff0000');

// Structural no-op also preserves redo; resize with identical layers is an edit.
const cell = App.getArtworkCell();
cell.layers = [{ id: 'l', type: 'layer', children: [{ id: 'r', type: 'region', pixels: { '2,2': '#00ff00' } }] }];
App.pushHistory();
cell.layers[0].children[0].pixels['3,3'] = '#0000ff';
App.pushHistory();
App.undo();
App.markDocumentSaved();
const structuralLength = App.state.history.length;
App.pushHistory();
assert.equal(App.state.isDirty, false);
assert.equal(App.state.history.length, structuralLength);
App.redo();
assert.equal(App.getArtworkCell().layers[0].children[0].pixels['3,3'], '#0000ff');
const sizeIndex = App.state.historyIndex;
App.state.w = 9;
App.pushHistory();
assert.equal(App.state.historyIndex, sizeIndex + 1);

// Presets are independent per instance and keep shared canonical colors.
const studio = Presets.create('studio');
const artwork = Presets.create('pixelart');
assert.deepEqual(studio.pico8, artwork.pico8);
studio.pico8[0] = '#abcdef';
assert.equal(Presets.create('studio').pico8[0], '#000000');
assert.equal(artwork.pico8[0], '#000000');
console.log('PASS shared raster / no-op dirty and redo / structure resize / preset isolation');

// Floating source identity, cancellation, ancestor locks, paste and stale documents.
const Floating = require('../js/editor-floating-selection.js');
const Transform = require('../js/selection-transform.js');
const PIX2 = require('../js/pix2-format.js');
const doc = PIX2.createDocument('Floating scope', 1, 1, 8, 8);
const sourceCell = doc.cells.cell_0_0;
const region = { id: 'a', type: 'region', pixels: { '1,1': '#ff0000', '2,1': '#00ff00' } };
const sibling = { id: 'b', type: 'region', pixels: { '1,1': '#0000ff' } };
const parent = { id: 'layer', type: 'layer', children: [region, sibling] };
sourceCell.layers = [parent];
const transient = {};
const session = Floating.create(transient);
const box = { x: 1, y: 1, w: 2, h: 1 };
const originalPixels = { ...region.pixels };
const copied = Transform.copyPixels(region, box);
assert.deepEqual(copied, { '0,0': '#ff0000', '1,0': '#00ff00' });
assert.deepEqual(region.pixels, originalPixels, 'Copy does not lift source');
session.lift(doc, sourceCell, region, box);
assert.deepEqual(region.pixels, {});
session.flip(box, true);
session.rotate90(box, { w: 8, h: 8 });
session.cancel();
assert.deepEqual(region.pixels, originalPixels, 'Cancel restores immutable lift-time raster');
assert.deepEqual(sibling.pixels, { '1,1': '#0000ff' });

session.lift(doc, sourceCell, region, box);
parent.locked = true;
assert.equal(session.commit(doc, { x: 4, y: 4, w: 2, h: 1 }, { w: 8, h: 8 }).status, 'cancelled');
assert.deepEqual(region.pixels, originalPixels, 'A newly locked ancestor cancels and restores source');
parent.locked = false;
session.lift(doc, sourceCell, region, box);
const otherDoc = PIX2.createDocument('Other document', 1, 1, 8, 8);
assert.equal(session.commit(otherDoc, box, { w: 8, h: 8 }).status, 'cancelled');
assert.deepEqual(region.pixels, originalPixels);
assert.deepEqual(otherDoc.cells.cell_0_0.pixels, {});

session.paste(doc, sourceCell, region, { x: 7, y: 7, w: 2, h: 1 }, copied);
session.cancel();
assert.deepEqual(region.pixels, originalPixels, 'Cancelling paste cannot erase destination pixels');
session.paste(doc, sourceCell, region, { x: 7, y: 7, w: 2, h: 1 }, copied);
assert.equal(session.commit(doc, { x: 7, y: 7, w: 2, h: 1 }, { w: 8, h: 8 }).status, 'committed');
assert.equal(region.pixels['7,7'], '#ff0000');
assert.equal(region.pixels['8,7'], undefined);
console.log('PASS shared floating selection / immutable cancel / lock / stale scope / paste clipping');

// Validated ingestion rejects diagnostic-bearing partial documents in both profiles.
const invalidSource = '@pix2 1.1\n@cell c\n p nope #fff';
for (const profile of ['studio', 'pixelart']) {
  assert.throws(() => PIX2.parseValidated(invalidSource, { profile }), /INVALID_COORDINATE/);
  assert.equal(PIX2.parseValidated('@pix2 1.0\n@cell c\n p 1,1 #f00', { profile }).meta.version, '1.0');
}
const Canvas = require('../js/editor-canvas.js');
session.lift(doc, sourceCell, region, box);
sourceCell.pixels = {};
const rejected = session.commit(otherDoc, box, { w: 8, h: 8 });
Canvas.refreshSourceComposite(PIX2, rejected.restored);
assert.equal(sourceCell.pixels['1,1'], '#0000ff', 'Rebuilt full composite honors the top sibling');
assert.equal(sourceCell.pixels['2,1'], '#00ff00', 'Restored old document composite is refreshed independently');
assert.deepEqual(otherDoc.cells.cell_0_0.pixels, {});
console.log('PASS validated ingestion / restored source composite ownership');
