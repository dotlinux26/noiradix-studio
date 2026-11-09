/** SAFE-02 structural visibility, opacity and source-over regressions. */
const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const EditorState = require('../js/editor-state.js');
const StructureOps = require('../js/structure-operations.js');

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

console.log('\n====================================================');
console.log('ALL SAFE-02 VISIBILITY TESTS PASSED (5/5)');
console.log('====================================================\n');
