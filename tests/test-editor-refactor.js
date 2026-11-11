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
