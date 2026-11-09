/** SAFE-02 structural visibility, opacity and source-over regressions. */
const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const EditorState = require('../js/editor-state.js');
const StructureOps = require('../js/structure-operations.js');
const Tools = require('../js/tools.js');

function makeDocument() {
  return {
    meta: {
      version: '1.1',
      title: 'SAFE-02 Visibility',
      grid: { cols: 1, rows: 1 },
      cell_size: { w: 4, h: 4 }
    },
    palette: {},
    animations: {},
    cells: {
      c0: {
        id: 'c0', name: 'Visibility Cell', size: { w: 4, h: 4 }, pixels: {},
        layers: [
          {
            type: 'layer', id: 'layer_bottom', cell: 'c0', name: 'Bottom', visible: true, locked: false,
            opacity: 1, blend: 'normal', children: [
              { type: 'region', id: 'region_bottom', cell: 'c0', parent: 'layer_bottom', name: 'Bottom Region', tags: [], visible: true, locked: false, pixels: { '1,1': '#ff0000', '2,2': '#00ff00ff' } }
            ]
          },
          {
            type: 'layer', id: 'layer_top', cell: 'c0', name: 'Top', visible: true, locked: false,
            opacity: 0.5, blend: 'normal', children: [
              {
                type: 'group', id: 'group_top', cell: 'c0', parent: 'layer_top', name: 'Top Group', tags: [], visible: true, locked: false,
                children: [
                  { type: 'region', id: 'region_top', cell: 'c0', parent: 'group_top', name: 'Top Region', tags: [], visible: true, locked: false, pixels: { '1,1': '#0000ff80', '3,3': '#ffffff80' } }
                ]
              }
            ]
          }
        ]
      }
    }
  };
}

function composite(doc) {
  return { ...PIX2.compositeCellLayers(doc.cells.c0, doc.meta.cell_size) };
}

console.log('====================================================');
console.log('RUNNING SAFE-02 VISIBILITY & COMPOSITING SUITE');
console.log('====================================================\n');

// 1. Alpha overlap must use source-over, then hide/show must round-trip exactly.
{
  const doc = makeDocument();
  const cell = doc.cells.c0;
  const topLayer = cell.layers[1];
  const topRegion = topLayer.children[0].children[0];
  const payloadBefore = JSON.parse(JSON.stringify(topRegion.pixels));
  const visibleComposite = composite(doc);
  assert.strictEqual(visibleComposite['1,1'], '#bf0040', '50%-opacity layer with 50%-alpha blue must source-over opaque red');
  assert.strictEqual(visibleComposite['3,3'], '#ffffff40', 'Layer opacity must multiply source alpha exactly once');

  for (let cycle = 0; cycle < 3; cycle++) {
    topLayer.visible = false;
    const hiddenComposite = composite(doc);
    assert.strictEqual(hiddenComposite['1,1'], '#ff0000');
    assert.strictEqual(hiddenComposite['3,3'], undefined);
    assert.deepStrictEqual(topRegion.pixels, payloadBefore, `Hidden cycle ${cycle + 1} must retain Region payload`);

    topLayer.visible = true;
    assert.deepStrictEqual(composite(doc), visibleComposite, `Show cycle ${cycle + 1} must restore exact RGBA composite`);
  }
  console.log('  [PASS] source-over/opacity are correct and three hide/show cycles preserve AST + exact RGBA composite');
}

// 2. Group visibility is inherited; lock is edit-only and must not hide artwork.
{
  const doc = makeDocument();
  const cell = doc.cells.c0;
  const group = cell.layers[1].children[0];
  const before = composite(doc);
  group.visible = false;
  assert.strictEqual(composite(doc)['3,3'], undefined, 'Hidden group hides descendants');
  group.visible = true;
  group.locked = true;
  assert.deepStrictEqual(composite(doc), before, 'Locked group remains fully rendered');
  console.log('  [PASS] inherited group visibility and render-independent lock semantics hold');
}

// 3. Studio history restores visibility and structural payload atomically.
{
  const state = new EditorState();
  state.setDocument(makeDocument());
  state.openCellTab('c0');
  const payload = JSON.parse(JSON.stringify(state.findNode('c0', 'region_top').node.pixels));
  assert.strictEqual(state.setNodeVisibility('c0', 'layer_top', false), true);
  assert.strictEqual(state.getActiveCell().pixels['3,3'], undefined);
  assert.strictEqual(state.undo(), true);
  assert.strictEqual(state.findNode('c0', 'layer_top').node.visible, true);
  assert.deepStrictEqual(state.findNode('c0', 'region_top').node.pixels, payload);
  assert.strictEqual(state.getActiveCell().pixels['3,3'], '#ffffff40');
  assert.strictEqual(state.redo(), true);
  assert.strictEqual(state.findNode('c0', 'layer_top').node.visible, false);
  assert.strictEqual(state.getActiveCell().pixels['3,3'], undefined);
  console.log('  [PASS] visibility Undo/Redo restores tree, payload and derived composite atomically');
}

// 4. Save/reload preserves hidden payload; showing after reload restores artwork.
{
  const doc = makeDocument();
  doc.cells.c0.layers[1].visible = false;
  const payloadBefore = JSON.parse(JSON.stringify(doc.cells.c0.layers[1].children[0].children[0].pixels));
  const saved = PIX2.serialize(doc);
  const reopened = PIX2.parse(saved, { profile: 'studio' });
  const reopenedTop = reopened.cells.c0.layers[1];
  assert.strictEqual(reopenedTop.visible, false);
  assert.deepStrictEqual(reopenedTop.children[0].children[0].pixels, payloadBefore, 'Hidden Region payload survives save/reload');
  assert.strictEqual(composite(reopened)['3,3'], undefined);
  reopenedTop.visible = true;
  assert.strictEqual(composite(reopened)['3,3'], '#ffffff40', 'Show after reload restores alpha-adjusted artwork');
  console.log('  [PASS] hidden structural payload survives serialization and can be shown after reload');
}

// 5. Documents created by the old PixelArt path migrate direct Layer pixels losslessly.
{
  const cell = {
    id: 'legacy', pixels: {}, layers: [
      { type: 'layer', id: 'old_layer', cell: 'legacy', name: 'Old Layer', visible: true, locked: false, opacity: 1, blend: 'normal', pixels: { '0,0': '#12345678' }, children: [] }
    ]
  };
  const normalized = StructureOps.normalizeRasterOwnership(cell);
  assert.strictEqual(normalized.changed, true);
  assert.strictEqual(cell.layers[0].pixels, undefined);
  assert.strictEqual(cell.layers[0].children[0].pixels['0,0'], '#12345678');
  const visible = { ...PIX2.compositeCellLayers(cell, { w: 4, h: 4 }) };
  cell.layers[0].visible = false;
  assert.strictEqual(PIX2.compositeCellLayers(cell, { w: 4, h: 4 })['0,0'], undefined);
  cell.layers[0].visible = true;
  assert.deepStrictEqual(PIX2.compositeCellLayers(cell, { w: 4, h: 4 }), visible);
  console.log('  [PASS] old direct-Layer payload migrates to a Region and remains hide/show safe');
}

// 6. Isolation views and incremental stroke compositing leave the full cache intact.
{
  const doc = makeDocument();
  const cell = doc.cells.c0;
  const full = PIX2.compositeCellLayers(cell, cell.size);
  const display = PIX2.compositeCellLayers(cell, cell.size, { isolatedNodeId: 'region_top', dimNonIsolated: 0 });
  assert.deepStrictEqual(display, { '1,1': '#0000ff40', '3,3': '#ffffff40' });
  assert.strictEqual(cell.pixels, full);
  const incremental = PIX2.compositeCellLayers(cell, cell.size, { coordinates: new Set(['1,1']) });
  assert.deepStrictEqual(incremental, { '1,1': full['1,1'] });
  assert.strictEqual(cell.pixels, full);
  delete StructureOps.findNode(cell, 'region_top').node.pixels['1,1'];
  const { updateComposite } = require('../js/editor-canvas.js');
  assert.deepStrictEqual(updateComposite(PIX2, cell, cell.size, new Set(['1,1']), 'region_top'), {});
  assert.strictEqual(cell.pixels, full);
  assert.equal(cell.pixels['1,1'], PIX2.compositeCellLayers(cell, cell.size, { coordinates: new Set(['1,1']) })['1,1']);
  assert.ok(cell.pixels['3,3']);
}

// 7. Hidden or locked ancestors block the whole target path without changing rendering.
{
  const doc = makeDocument();
  const cell = doc.cells.c0;
  const top = cell.layers[1];
  const full = composite(doc);
  top.children[0].locked = true;
  assert.strictEqual(StructureOps.hitRegion(cell, 1, 1, top.id), null);
  assert.strictEqual(Tools.getTargetForPlot(cell, 'region_top'), null);
  assert.deepStrictEqual(composite(doc), full);
  top.children[0].locked = false;
  assert.strictEqual(StructureOps.hitRegion(cell, 1, 1, top.id).node.id, 'region_top');
  assert.strictEqual(StructureOps.hitRegion(cell, 1, 1, cell.layers[0].id).node.id, 'region_bottom');
  assert.strictEqual(StructureOps.hitRegion(cell, 1, 1, top.id, 'region_bottom'), null);
}

// Overlapping raster siblings follow paint order even while one is isolated.
{
  const lower = { id: 'lower', type: 'region', pixels: { '1,1': '#ff0000' } };
  const upper = { id: 'upper', type: 'region', pixels: { '1,1': '#00ff00' } };
  const cell = { layers: [{ id: 'layer', type: 'layer', children: [lower, upper] }] };
  const point = { x: 1, y: 1 };
  const state = { activeLayerId: 'layer', isolatedNodeId: 'upper' };
  assert.equal(StructureOps.pickIsolationRegion(cell, point, state, true).node.id, 'lower');
  lower.visible = false;
  assert.equal(StructureOps.pickIsolationRegion(cell, point, state, true).node.id, 'upper');
  lower.visible = true;
  lower.locked = true;
  assert.equal(StructureOps.pickIsolationRegion(cell, point, state, true).node.id, 'upper');
  upper.pixels['1,1'] = '#00ff0000';
  assert.equal(StructureOps.pickIsolationRegion(cell, point, state, true), null);
}

// 8. Even brush sizes snap around the closest grid intersection.
{
  const dimensions = { w: 16, h: 16 };
  const point = Tools.brushPoint({ x: 49, y: 61, zoom: 10 }, 4, dimensions);
  assert.deepStrictEqual(point, { x: 5, y: 6 });
  const pixels = new Set();
  Tools.brushStroke(point.x, point.y, point.x, point.y, 4, dimensions, (x, y) => pixels.add(`${x},${y}`));
  assert.strictEqual(pixels.size, 16);
  assert.ok(pixels.has('3,4') && pixels.has('6,7'));
  assert.deepStrictEqual(Tools.brushPoint({ x: 49, y: 61, zoom: 10 }, 3, dimensions), { x: 4, y: 6 });
}

// 9. Display names may coincide. Reorder and grouping use stable node IDs.
{
  const cell = {
    id: 'c0',
    layers: [
      { id: 'a', type: 'layer', name: 'Same', children: [] },
      { id: 'b', type: 'layer', name: 'Same', children: [] }
    ]
  };
  assert.ok(StructureOps.moveNode(cell, 'a', null, 2).ok);
  assert.deepStrictEqual(cell.layers.map(node => node.id), ['b', 'a']);
  const children = cell.layers[0].children;
  for (const id of ['r1', 'r2', 'r3', 'r4']) children.push({ id, type: 'region', pixels: {} });
  const first = StructureOps.groupNodes(cell, ['r1', 'r2']);
  const second = StructureOps.groupNodes(cell, ['r3', 'r4']);
  assert.strictEqual(first.name, 'Group');
  assert.strictEqual(second.name, 'Group 2');
  second.name = first.name;
  assert.deepStrictEqual(StructureOps.ungroupNode(cell, second.id).map(node => node.id), ['r3', 'r4']);
  assert.strictEqual(StructureOps.findNode(cell, first.id).node, first);
}

console.log('\n====================================================');
console.log('ALL SAFE-02 VISIBILITY TESTS PASSED (9/9)');
console.log('====================================================\n');
