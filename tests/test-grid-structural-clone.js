const assert = require('node:assert');
const PIX2 = require('../js/pix2-format.js');
const StructureOps = require('../js/structure-operations.js');

const input = `@pix2 1.1
@meta
  title: "Clone"
  version: "1.1"
@grid
  columns: 2
  rows: 1
  default_cell: 2x2
@palette
  1: #ff0000
@cell cell_0_0
  grid_pos: 0,0
@layer layer_a
  cell: cell_0_0
@group group_a
  cell: cell_0_0
  parent: layer_a
@region region_a
  cell: cell_0_0
  parent: group_a
  pixel 0,0 1
@cell cell_0_1
  grid_pos: 0,1
@end`;
const doc = PIX2.parseValidated(input);
const original = doc.cells.cell_0_0;
const dest = doc.cells.cell_0_1;
dest.layers = StructureOps.cloneLayersForCell(doc, original.layers, dest.id);
PIX2.compositeCellLayers(dest, doc.meta.cellSize);
const roundtrip = PIX2.parseValidated(PIX2.serialize(doc));
assert.deepStrictEqual(roundtrip.cells.cell_0_1.pixels, roundtrip.cells.cell_0_0.pixels);
const layer = roundtrip.cells.cell_0_1.layers[0];
assert.notStrictEqual(layer.id, original.layers[0].id);
assert.equal(layer.cell, dest.id);
assert.equal(layer.children[0].parent, layer.id);
assert.equal(layer.children[0].children[0].parent, layer.children[0].id);
const secondCopy = StructureOps.cloneLayersForCell(doc, original.layers, dest.id);
assert.notEqual(secondCopy[0].id, dest.layers[0].id, 'repeated copies must not reuse IDs already in the document');
original.size = { w: 32, h: 32 };
original.layers[0].children[0].children[0].pixels['30,30'] = '#ff0000';
const flattened = PIX2.flattenV11ToV10(doc);
assert.equal(flattened.success, true);
assert.deepEqual(flattened.doc.meta.cellSize, doc.meta.cellSize,
  'flattening restores the non-enumerable editor size alias after cloning');
assert.equal(flattened.doc.cells.cell_0_0.pixels['30,30'], '#ff0000',
  'flattening uses the individual frame size instead of clipping to the grid default');
assert.equal(flattened.doc.cells.cell_0_0.layers, undefined);
console.log('Grid structural clone survives serialization with distinct node IDs.');
