/**
 * NOIRADIX Studio 2.0 / PixelArt 2.0 - Complete Multi-Track Integration Test Suite
 * Verifies PIX2 1.1 structural alignment, selection transform engine,
 * multi-document session isolation, and modular component export.
 */
const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const Tools = require('../js/tools.js');
const SelectionTransform = require('../js/selection-transform.js');
const ModularExport = require('../js/modular-export.js');

console.log('====================================================');
console.log('RUNNING PIXELART 2.0 & MULTI-TRACK INTEGRATION SUITE');
console.log('====================================================\n');

// Test 1: PIX2 1.1 Structural Document Ingestion & Layer Compositing
console.log('Test 1: PIX2 1.1 Structural Hierarchy Ingestion & Compositing');
{
  const v11Source = `@pix2 1.1
@meta
  title: "Hero"
@grid
  columns: 1
  rows: 1
  default_cell: 16x16
@cell hero
  name: "Hero Stand"
  grid_pos: 0,0
  size: 16x16
@layer layer_bg
  cell: hero
  name: "Background"
  visible: true
  opacity: 1.0
  blend: normal
@region reg_bg
  cell: hero
  parent: layer_bg
  name: "Sky"
  p 0,0 #336699
  p 1,0 #336699
@layer layer_char
  cell: hero
  name: "Character"
  visible: true
  opacity: 1.0
  blend: normal
@group grp_head
  cell: hero
  parent: layer_char
  name: "Head"
@region reg_eye
  cell: hero
  parent: grp_head
  name: "Left Eye"
  tags: [face, eye]
  p 0,0 #ffffff
`;

  const doc = PIX2.parse(v11Source);
  assert.strictEqual(doc.meta.version, '1.1');
  const cell = doc.cells.hero;
  assert.ok(cell, 'Hero cell exists');
  assert.strictEqual(cell.layers.length, 2, 'Cell has 2 layers');

  // Verify layer compositing: at (0,0), layer_char (reg_eye #ffffff) composites over layer_bg (reg_bg #336699)
  const composite = PIX2.compositeCellLayers(cell, { w: 16, h: 16 });
  assert.strictEqual(composite['0,0'], '#ffffff', 'Character eye composites over background');
  assert.strictEqual(composite['1,0'], '#336699', 'Background sky pixel shows through where no char pixel exists');

  console.log('  [PASS] PIX2 1.1 structural AST parsed and compositeCellLayers accurately composited normal layers');
}

// Test 2: Selection Transform Parity & Nearest-Neighbor Resampling
console.log('\nTest 2: Selection Transform Parity (Free vs Uniform Scale & Nearest-Neighbor)');
{
  const pixels = {
    '0,0': '#ff0000',
    '1,0': '#00ff00',
    '0,1': '#0000ff',
    '1,1': '#ffffff'
  };

  // Uniform 3x scale: 2x2 -> 6x6
  const scaled = SelectionTransform.scalePixelsNearestNeighbor(pixels, 2, 2, 6, 6);
  assert.strictEqual(Object.keys(scaled).length, 36, 'All 36 destination pixels populated');
  // Check corner pixels
  assert.strictEqual(scaled['0,0'], '#ff0000');
  assert.strictEqual(scaled['5,0'], '#00ff00');
  assert.strictEqual(scaled['0,5'], '#0000ff');
  assert.strictEqual(scaled['5,5'], '#ffffff');

  // Handle hit testing
  const handles = SelectionTransform.getSelectionHandles({ x: 5, y: 5, w: 10, h: 10 }, 8);
  assert.ok(handles.rot, 'Rotation handle present');
  assert.ok(handles.nw, 'North-west handle present');
  assert.ok(handles.se, 'South-east handle present');
  assert.ok(handles.n, 'North handle present');
  assert.ok(handles.e, 'East handle present');

  console.log('  [PASS] Selection transform nearest-neighbor scaling and handle geometry verified');
}

// Test 3: Region Isolation Scoping with Tools.plotPixel
console.log('\nTest 3: Region Isolation Scoping in Tools Engine');
{
  const cell = {
    id: 'cell_test',
    layers: [
      {
        id: 'layer_1',
        name: 'Layer 1',
        visible: true,
        children: [
          {
            type: 'region',
            id: 'reg_unlocked',
            name: 'Target Region',
            pixels: { '2,2': '#111111' }
          },
          {
            type: 'region',
            id: 'reg_isolated',
            name: 'Isolated Region',
            pixels: { '5,5': '#222222' }
          }
        ]
      }
    ]
  };

  // With isolatedNodeId set to 'reg_isolated':
  const isolatedTarget = Tools.getTargetForPlot(cell, 'reg_isolated');
  assert.strictEqual(isolatedTarget, cell.layers[0].children[1], 'Target resolved strictly to isolated region node');

  // Plotting a pixel must write ONLY to the isolated region
  Tools.plotPixel(cell, 6, 6, '#44ff44', null, 16, 'reg_isolated');
  assert.strictEqual(cell.layers[0].children[1].pixels['6,6'], '#44ff44', 'Wrote to isolated region');
  assert.strictEqual(cell.layers[0].children[0].pixels['6,6'], undefined, 'Other region remained completely untouched');

  console.log('  [PASS] Isolation mode scopes paint operations strictly to isolated region target');
}

// Test 4: Modular Component Export & Zero-Dependency ZIP Package
console.log('\nTest 4: Modular Component Export & Manifest Structure');
{
  const doc = {
    meta: { version: '1.1', title: 'ModularHero', cellSize: { w: 16, h: 16 } },
    cells: {
      hero_0: {
        id: 'hero_0',
        name: 'Hero 0',
        size: { w: 16, h: 16 },
        layers: [
          {
            id: 'layer_body',
            name: 'Body',
            visible: true,
            children: [
              {
                type: 'region',
                id: 'reg_torso',
                name: 'Torso',
                pixels: { '4,4': '#990000', '5,4': '#990000' }
              }
            ]
          },
          {
            id: 'layer_hat',
            name: 'Hat',
            visible: true,
            children: [
              {
                type: 'region',
                id: 'reg_cap',
                name: 'Cap',
                pixels: { '4,2': '#009900' }
              }
            ]
          }
        ]
      }
    },
    animations: {}
  };

  const exportResult = ModularExport.exportModularComponents(doc, { mode: 'modular', trimmed: false });
  assert.ok(exportResult.manifest, 'Manifest generated');
  assert.strictEqual(exportResult.manifest.generator, 'NOIRADIX Studio 2.1.8');
  assert.strictEqual(exportResult.manifest.formatVersion, '1.1');
  assert.strictEqual(exportResult.manifest.components.length, 2, '2 components exported');
  assert.ok(exportResult.zip, 'ZIP archive generated');
  assert.ok(exportResult.zip.length > 50, 'ZIP has positive binary length');

  console.log('  [PASS] Modular Component Export generates manifest and compliant ZIP package');
}

// Test 5: PixelArt Multi-Document Session Isolation
console.log('\nTest 5: PixelArt Multi-Document Project Session Isolation');
{
  const paApp = require('../pixelart/js/pixelart-app.js');

  const doc1 = PIX2.parse(`@pix2 1.0\n@meta\n  title: "Doc1"\n@grid\n  columns: 1\n  rows: 1\n  default_cell: 16x16\n@cell c1\n  p 0,0 #ff0000\n`);
  const doc2 = PIX2.parse(`@pix2 1.0\n@meta\n  title: "Doc2"\n@grid\n  columns: 1\n  rows: 1\n  default_cell: 16x16\n@cell c1\n  p 2,2 #00ff00\n`);

  const s1 = paApp.createPaProjectSession('Doc 1', doc1, null);
  assert.ok(s1, 'Session 1 created');
  assert.strictEqual(paApp.state.title, 'Doc 1');
  assert.strictEqual(paApp.getArtworkCell().pixels['0,0'], '#ff0000');

  // Mark session 1 dirty with an edit
  paApp.state.isDirty = true;

  const s2 = paApp.createPaProjectSession('Doc 2', doc2, null);
  assert.ok(s2, 'Session 2 created');
  assert.strictEqual(paApp.state.title, 'Doc 2');
  assert.strictEqual(paApp.getArtworkCell().pixels['2,2'], '#00ff00');
  assert.strictEqual(paApp.state.isDirty, false, 'Session 2 has independent clean dirty state');

  // Switch back to session 1
  paApp.switchPaProjectSession(s1.id);
  assert.strictEqual(paApp.state.title, 'Doc 1');
  assert.strictEqual(paApp.state.isDirty, true, 'Session 1 preserved dirty state upon tab switch');
  assert.strictEqual(paApp.getArtworkCell().pixels['0,0'], '#ff0000');

  console.log('  [PASS] Multi-document sessions maintain independent AST, dirty state, and canvas context');
}

// Test 6: PixelArt Structural Hierarchy Lookup & Isolation Mode
console.log('\nTest 6: PixelArt Structural Hierarchy Lookup & Isolation Mode');
{
  const paApp = require('../pixelart/js/pixelart-app.js');
  const v11Doc = PIX2.parse(`@pix2 1.1
@meta
  title: "Player"
@grid
  columns: 1
  rows: 1
  default_cell: 16x16
@cell p1
@layer l_body
  cell: p1
  name: "Body"
@group g_torso
  cell: p1
  parent: l_body
  name: "Torso"
@region r_chest
  cell: p1
  parent: g_torso
  name: "Chest Armor"
  p 2,2 #4444ff
`);

  const cell = v11Doc.cells.p1;
  const chestRegion = paApp.findNodeById(cell, 'r_chest');
  assert.ok(chestRegion, 'findNodeById found nested region');
  assert.strictEqual(chestRegion.name, 'Chest Armor');
  assert.strictEqual(chestRegion.pixels['2,2'], '#4444ff');

  const torsoGroup = paApp.findNodeById(cell, 'g_torso');
  assert.ok(torsoGroup, 'findNodeById found parent group');
  assert.strictEqual(torsoGroup.name, 'Torso');

  // Isolation mode transitions
  const previousDoc = paApp.state.doc;
  paApp.state.doc = v11Doc;
  paApp.enterIsolationMode('r_chest', 'Body / Torso / Chest Armor');
  assert.strictEqual(paApp.state.isolatedNodeId, 'r_chest', 'Isolation mode set to chest region');

  paApp.exitIsolationMode();
  assert.strictEqual(paApp.state.isolatedNodeId, null, 'Isolation mode cleared on exit');
  paApp.state.doc = previousDoc;

  console.log('  [PASS] Structural node lookup and isolation mode transitions verified');
}

// Test 7: Zero Cross-Region Mutation Invariant
console.log('\nTest 7: Zero Cross-Region Mutation Invariant');
{
  const v11Doc = PIX2.parse(`@pix2 1.1
@meta
  title: "Dual"
@grid
  columns: 1
  rows: 1
  default_cell: 16x16
@cell c1
@layer l_base
  cell: c1
  name: "Base"
@region r_left
  cell: c1
  parent: l_base
  name: "Left"
  p 1,1 #ff0000
@region r_right
  cell: c1
  parent: l_base
  name: "Right"
  p 5,5 #00ff00
`);

  const cell = v11Doc.cells.c1;
  const leftTarget = Tools.getTargetForPlot(cell, 'r_left');
  assert.strictEqual(leftTarget.id, 'r_left');

  // Plot a pixel into left region
  Tools.plotPixel(cell, 2, 2, '#ff8800', null, 16, leftTarget);
  assert.strictEqual(leftTarget.pixels['2,2'], '#ff8800');

  // Verify r_right was NOT mutated
  const rightTarget = Tools.getTargetForPlot(cell, 'r_right');
  assert.strictEqual(rightTarget.pixels['2,2'], undefined, 'Right region remains strictly unmutated');
  assert.strictEqual(rightTarget.pixels['5,5'], '#00ff00');

  console.log('  [PASS] Zero cross-region mutation invariant upheld');
}

// Test 8: PixelArt 2.0 DOM Contract Verification
console.log('\nTest 8: PixelArt 2.0 DOM Contract Verification');
{
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '../pixelart/index.html'), 'utf8');
  const toolbar = fs.readFileSync(path.join(__dirname, '../js/editor-toolbar.js'), 'utf8');

  const requiredIds = [
    'pa-isolation-banner',
    'pa-isolation-breadcrumb',
    'btn-pa-exit-isolation',
    'pa-layers-view',
    'pa-layers-tree',
    'btn-pa-add-layer',
    'btn-pa-add-group',
    'btn-pa-add-region',
    'btn-pa-side-layers',
    'pa-project-tabs-strip',
    'modal-about-pa'
  ];

  for (const id of requiredIds) {
    assert(html.includes(`id="${id}"`), `pixelart/index.html must define #${id}`);
  }
  assert(/src="\.\.\/js\/editor-toolbar\.js(?:\?[^\"]*)?"/.test(html) && toolbar.includes('id="btn-pa-tool-region-select"'),
    'PixelArt loads its Region Select control from the shared toolbar');

  console.log('  [PASS] PixelArt 2.0 Structure, Layers, and Region Select UI contract verified');
}

// Test 9: PixelArt Multi-Document Session Synchronization & Dimension Propagation
console.log('\nTest 9: PixelArt Multi-Document Session Synchronization & Dimension Propagation');
{
  const paApp = require('../pixelart/js/pixelart-app.js');
  const doc32 = PIX2.parse(`@pix2 1.1
@meta
  title: "Sprite32"
@grid
  columns: 1
  rows: 1
  default_cell: 32x32
@cell s32
  size: 32x32
  p 0,0 #123456
`);

  // Create session with 32x32 document
  const s32 = paApp.createPaProjectSession('Sprite32', doc32, null);
  assert.strictEqual(s32.w, 32, 'Session width accurately derived from doc cell size');
  assert.strictEqual(s32.h, 32, 'Session height accurately derived from doc cell size');
  assert.strictEqual(paApp.state.w, 32, 'App state width updated to 32');
  assert.strictEqual(paApp.state.h, 32, 'App state height updated to 32');

  // Verify dirty state propagation to session
  paApp.setDirty(true);
  assert.strictEqual(s32.isDirty, true, 'Session isDirty synchronized via setDirty(true)');
  paApp.setDirty(false);
  assert.strictEqual(s32.isDirty, false, 'Session isDirty synchronized via setDirty(false)');

  console.log('  [PASS] Multi-document session dimensions and dirty state synchronized accurately');
}

console.log('\n====================================================');
console.log('ALL PIXELART 2.0 & MULTI-TRACK TESTS PASSED (9/9)');
console.log('====================================================\n');
