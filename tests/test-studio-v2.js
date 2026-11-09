/**
 * NOIRADIX Studio 2.0 & PIX2 1.1 - Comprehensive Integration Test Suite
 * Covers:
 * 1. Platformer 2D Animation System & Missing Clip Diagnostics
 * 2. EditorState & Tools Structural Interoperability (Plot, Erase, FloodFill, Transforms)
 * 3. Import & Slice Ingestion Pipeline
 * 4. Product & Format Version Manifest Integrity
 */

const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const Tools = require('../js/tools.js');
const EditorState = require('../js/editor-state.js');
const AnimationPlayer = require('../js/animation-player.js');
const ImportSlice = require('../js/import-slice.js');
const NOIRADIX_VERSION = require('../js/version.js');

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`  [PASS] ${msg}`);
}

console.log('====================================================');
console.log('RUNNING NOIRADIX STUDIO 2.0 INTEGRATION TEST SUITE');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Product & Format Version Manifest
// -----------------------------------------------------------------------------
console.log('Test 1: Version Manifest & Domain Verification');
{
  assert.strictEqual(NOIRADIX_VERSION.studio.version, '2.0.0', 'Studio version must be 2.0.0');
  assert.strictEqual(NOIRADIX_VERSION.pixelart.version, '2.0.0', 'PixelArt version must be 2.0.0');
  assert.strictEqual(NOIRADIX_VERSION.format.version, '1.1', 'Format version must be 1.1');
  assert.strictEqual(NOIRADIX_VERSION.canonicalDomain, 'https://noiradix.me', 'Canonical domain must strictly be https://noiradix.me');
  assert(!JSON.stringify(NOIRADIX_VERSION).includes('.org'), 'Must NEVER contain .org domain');
  pass('NOIRADIX 2.0 version manifest verified (Studio 2.0.0 / PixelArt 2.0.0 / PIX2 1.1)');
}

// -----------------------------------------------------------------------------
// Test 2: Platformer 2D Animation System (AnimationPlayer)
// -----------------------------------------------------------------------------
console.log('\nTest 2: Platformer 2D Animation Controls & Diagnostics');
{
  const mockCanvas = {
    width: 64,
    height: 64,
    getContext: () => ({
      imageSmoothingEnabled: false,
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {}
    })
  };

  const player = new AnimationPlayer(mockCanvas);
  assert.strictEqual(player.directions2.length, 2, 'Must define 2 directions for platformer (right, left)');
  assert.strictEqual(player.directions2[0].id, 'right', 'Row 0 is right');
  assert.strictEqual(player.directions2[1].id, 'left', 'Row 1 is left');

  player.setMode('platformer_2dir');
  assert.strictEqual(player.currentMode, 'platformer_2dir');
  assert.strictEqual(player.currentDirection, 'right', 'Platformer defaults to right when non-2dir');

  // Create mock state doc with partial platformer clips
  global.window = {
    state: {
      doc: {
        meta: { cellSize: { w: 16, h: 16 }, grid: { rows: 2, cols: 4 } },
        cells: {
          'cell_0_0': { id: 'cell_0_0', pixels: { '0,0': '#ffffff' } },
          'cell_0_1': { id: 'cell_0_1', pixels: { '1,1': '#ffffff' } },
          'cell_1_0': { id: 'cell_1_0', pixels: { '2,2': '#ffffff' } }
        },
        animations: {
          idle_right: {
            name: 'Idle Right',
            direction: 'right',
            action: 'idle',
            template: 'platformer_2dir',
            frames: ['cell_0_0', 'cell_0_1'],
            fps: 6
          }
        }
      }
    }
  };

  const frames = player.getActiveFrames();
  assert.deepStrictEqual(frames, ['cell_0_0', 'cell_0_1'], 'Resolves active platformer frames');

  // Test missing clip diagnostics
  const missing = player.getMissingClipDiagnostics();
  assert(missing.includes('idle_left'), 'Must report missing idle_left');
  assert(missing.includes('run_right'), 'Must report missing run_right');
  assert(missing.includes('run_left'), 'Must report missing run_left');
  assert(!missing.includes('idle_right'), 'Must NOT report idle_right as missing');
  pass('Platformer 2D animation player and missing clip diagnostics verified');
}

// -----------------------------------------------------------------------------
// Test 3: Structural Interoperability (Tools & EditorState)
// -----------------------------------------------------------------------------
console.log('\nTest 3: Tools & EditorState Structural Hierarchy Interoperability');
{
  const editor = new EditorState();
  const doc = PIX2.createDocument('Structural Test', 1, 1, 16, 16);
  editor.setDocument(doc);
  global.window.state = editor;

  // Add layer and region
  const layer = editor.addLayer('cell_0_0', 'Hero Layer');
  const region = layer.children[0];
  assert.strictEqual(editor.activeRegionId, region.id);

  const cell = doc.cells['cell_0_0'];

  // 1. Tools.plotPixel writes into active region and syncs composite
  Tools.plotPixel(cell, 4, 5, '#123456');
  assert.strictEqual(region.pixels['4,5'], '#123456', 'Pixel plotted into active region');
  assert.strictEqual(cell.pixels['4,5'], '#123456', 'Pixel composited into cell');

  // 2. Tools.erasePixel erases from active region and syncs composite
  Tools.erasePixel(cell, 4, 5);
  assert.strictEqual(region.pixels['4,5'], undefined, 'Pixel erased from active region');
  assert.strictEqual(cell.pixels['4,5'], undefined, 'Pixel removed from composite');

  // 3. Flood fill inside region
  Tools.plotPixel(cell, 0, 0, '#000000');
  Tools.floodFill(cell, 0, 0, '#ff00aa', doc.meta.cellSize);
  assert.strictEqual(region.pixels['0,0'], '#ff00aa', 'Region pixel flooded');
  assert.strictEqual(cell.pixels['0,0'], '#ff00aa', 'Cell composite updated after flood fill');

  // 4. Transforms inside region
  region.pixels = { '2,2': '#111111' };
  editor.syncCellComposite('cell_0_0');
  Tools.nudge(cell, 1, 1, 16, 16);
  assert.strictEqual(region.pixels['3,3'], '#111111', 'Region pixel nudged');
  assert.strictEqual(cell.pixels['3,3'], '#111111', 'Composite cell nudged');

  pass('Tools & EditorState structural mutations and composite synchronization verified');
}

// -----------------------------------------------------------------------------
// Test 4: Isolation Mode Scoping
// -----------------------------------------------------------------------------
console.log('\nTest 4: Isolation Mode Scoping');
{
  const editor = global.window.state;
  const doc = editor.doc;
  const cell = doc.cells['cell_0_0'];

  // Add second layer with region
  const layer2 = editor.addLayer('cell_0_0', 'Equipment Layer');
  const region2 = layer2.children[0];

  region2.pixels = { '5,5': '#aabbcc' };
  editor.syncCellComposite('cell_0_0');

  // Isolate layer 1's region
  const region1 = cell.layers[0].children[0];
  editor.setIsolation('cell_0_0', region1.id);
  assert.strictEqual(editor.isolatedNodeId, region1.id);

  // Plotting when isolated writes to region 1 only
  Tools.plotPixel(cell, 7, 7, '#990000');
  assert.strictEqual(region1.pixels['7,7'], '#990000', 'Wrote to isolated region');
  assert.strictEqual(region2.pixels['7,7'], undefined, 'Did not touch non-isolated region');

  // Exit isolation
  editor.setIsolation('cell_0_0', null);
  assert.strictEqual(editor.isolatedNodeId, null);
  pass('Isolation mode scopes drawing operations exclusively to target node');
}

// -----------------------------------------------------------------------------
// Test 5: Import & Slice to Document Pipeline
// -----------------------------------------------------------------------------
console.log('\nTest 5: Import & Slice Ingestion Pipeline');
{
  const doc = PIX2.createDocument('Import Test Project', 1, 1, 16, 16);
  const frames = [
    {
      name: 'hero_idle_0',
      frame: { x: 0, y: 0, w: 16, h: 16 },
      sourceSize: { w: 16, h: 16 },
      spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 }
    },
    {
      name: 'hero_idle_1',
      frame: { x: 16, y: 0, w: 16, h: 16 },
      sourceSize: { w: 16, h: 16 },
      spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 }
    }
  ];

  // Mock 32x16 RGBA buffer
  const rawBytes = new Uint8Array(32 * 16 * 4);
  // Put a red pixel at (0,0) and a blue pixel at (16,0)
  rawBytes[0] = 255; rawBytes[1] = 0; rawBytes[2] = 0; rawBytes[3] = 255;
  const blueIdx = (0 * 32 + 16) * 4;
  rawBytes[blueIdx] = 0; rawBytes[blueIdx + 1] = 0; rawBytes[blueIdx + 2] = 255; rawBytes[blueIdx + 3] = 255;

  const resultDoc = ImportSlice.importFramesToDoc(doc, frames, { width: 32, height: 16, data: rawBytes }, {
    layerName: 'Imported Layer',
    createAnimations: true
  });

  assert(resultDoc.cells['imported_hero_idle_0'], 'Cell 0 created');
  assert(resultDoc.cells['imported_hero_idle_1'], 'Cell 1 created');
  assert.strictEqual(resultDoc.cells['imported_hero_idle_0'].pixels['0,0'], '#ff0000', 'Red pixel extracted');
  assert.strictEqual(resultDoc.cells['imported_hero_idle_1'].pixels['0,0'], '#0000ff', 'Blue pixel extracted with frame offset');
  assert(resultDoc.animations['hero_idle'], 'Animation clip auto-assembled');
  assert.strictEqual(resultDoc.animations['hero_idle'].frames.length, 2);

  pass('Import & Slice pipeline ingests frames and auto-assembles animations cleanly');
}

// -----------------------------------------------------------------------------
// Test 6: Non-Destructive Frame Resize with Structural Layers
// -----------------------------------------------------------------------------
console.log('\nTest 6: Non-Destructive Frame Resize with Structural Layers');
{
  const doc = PIX2.createDocument('Resize Test Project', 1, 1, 16, 16);
  const cell = doc.cells['cell_0_0'];

  // Add layer and region
  const layer = {
    id: 'layer_base',
    type: 'layer',
    name: 'Base Layer',
    visible: true,
    opacity: 1,
    pixels: { '2,2': '#112233', '15,15': '#445566' }
  };
  cell.layers = [layer];
  PIX2.compositeCellLayers(cell);

  assert.strictEqual(cell.pixels['2,2'], '#112233');
  assert.strictEqual(cell.pixels['15,15'], '#445566');

  // Resize bounds to 32x32 (expand)
  PIX2.resizeCells(doc, 32, 32, 'expand');
  assert.strictEqual(doc.meta.cellSize.w, 32);
  assert.strictEqual(doc.meta.cellSize.h, 32);
  assert.strictEqual(cell.size.w, 32);
  assert.strictEqual(cell.size.h, 32);
  assert.strictEqual(layer.pixels['2,2'], '#112233', 'Existing pixels preserved in layer');
  assert.strictEqual(layer.pixels['15,15'], '#445566', 'Existing pixels preserved in layer');
  assert.strictEqual(cell.pixels['2,2'], '#112233', 'Composite retains pixel at (2,2)');
  assert.strictEqual(cell.pixels['15,15'], '#445566', 'Composite retains pixel at (15,15)');

  // Resize bounds down to 10x10 (crop)
  PIX2.resizeCells(doc, 10, 10, 'expand');
  assert.strictEqual(doc.meta.cellSize.w, 10);
  assert.strictEqual(cell.size.w, 10);
  assert.strictEqual(layer.pixels['2,2'], '#112233', 'Pixel within (10,10) retained');
  assert.strictEqual(layer.pixels['15,15'], undefined, 'Pixel outside bounds pruned');
  assert.strictEqual(cell.pixels['15,15'], undefined, 'Composite pixel outside bounds pruned');

  pass('PIX2.resizeCells preserves structural layers and re-composites cleanly on expand/crop');
}

// -----------------------------------------------------------------------------
// Test 7: AnimationPlayer Explicit Platformer Action Diagnostics
// -----------------------------------------------------------------------------
console.log('\nTest 7: AnimationPlayer Platformer Action Diagnostics & Clip Resolution');
{
  const mockCanvas = {
    getContext: () => ({ imageSmoothingEnabled: false, clearRect: () => {}, fillRect: () => {}, drawImage: () => {} })
  };
  const player = new AnimationPlayer(mockCanvas);
  player.setMode('platformer_2dir');
  player.setDirection('left');

  // Mock state with only idle_right and idle_left
  global.window.state = {
    doc: {
      meta: { cellSize: { w: 16, h: 16 }, grid: { rows: 2, cols: 4 } },
      cells: {
        'cell_0_0': { id: 'cell_0_0', pixels: {} },
        'cell_1_0': { id: 'cell_1_0', pixels: {} }
      },
      animations: {
        idle_left: { name: 'Idle Left', direction: 'left', frames: ['cell_1_0'] },
        idle_right: { name: 'Idle Right', direction: 'right', frames: ['cell_0_0'] }
      }
    }
  };

  // 1. Without explicit action, resolves idle_left
  let anim = player.getActiveAnimationObj();
  assert.strictEqual(anim.name, 'Idle Left');

  // 2. Set explicit action to 'jump' (missing)
  player.setAction('jump');
  anim = player.getActiveAnimationObj();
  assert.strictEqual(anim, null, 'Must return null instead of silently falling back to idle or run');
  const frames = player.getActiveFrames();
  assert.deepStrictEqual(frames, [], 'Must return empty frames when explicit action is missing');

  // 3. Diagnostics reports missing jump clips
  const missing = player.getMissingClipDiagnostics();
  assert(missing.includes('jump_left'), 'Must report jump_left missing');
  assert(missing.includes('jump_right'), 'Must report jump_right missing');

  // Reset action
  player.setAction(null);
  assert.strictEqual(player.currentAction, null);

  pass('AnimationPlayer action scoping, missing clip diagnostics, and null fallback verified');
}

// -----------------------------------------------------------------------------
// Test 8: Studio 2.0 Structure & Layers DOM Contract Verification
// -----------------------------------------------------------------------------
console.log('\nTest 8: Studio 2.0 Structure & Layers DOM Contract Verification');
{
  const fs = require('fs');
  const path = require('path');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  const requiredIds = [
    'btn-tool-region-select',
    'isolation-banner',
    'isolation-breadcrumb-text',
    'btn-exit-isolation',
    'structure-layers-card',
    'structure-tree-container',
    'btn-add-layer',
    'btn-add-group',
    'btn-add-region',
    'btn-resize-frame',
    'modal-resize-frame',
    'modal-new-file',
    'new-file-summary-card'
  ];

  for (const id of requiredIds) {
    assert(indexHtml.includes(`id="${id}"`), `index.html must define DOM element #${id}`);
  }

  pass('Studio 2.0 Structure & Layers UI contract verified in production index.html');
}

// -----------------------------------------------------------------------------
// Test 9: Studio Multi-Project Tabs & Primary Workspace Tab Invariants
// -----------------------------------------------------------------------------
console.log('\nTest 9: Studio Multi-Project Tabs & Primary Tab Strip Invariants');
{
  const fs = require('fs');
  const path = require('path');
  const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  // A. Primary Workspace Tabs invariant: The 4 core tabs must be rendered first, in order inside renderTabs()
  const renderTabsStart = appJs.indexOf('function renderTabs() {');
  const renderTabsEnd = appJs.indexOf('function createTabElement(', renderTabsStart);
  assert(renderTabsStart !== -1 && renderTabsEnd !== -1, 'renderTabs() must be defined');
  const renderTabsBody = appJs.slice(renderTabsStart, renderTabsEnd);

  const gridIdx = renderTabsBody.indexOf("'tab-grid-overview'");
  const animIdx = renderTabsBody.indexOf("'tab-anim-studio'");
  const sliceIdx = renderTabsBody.indexOf("'tab-import-slice'");
  const codeIdx = renderTabsBody.indexOf("'tab-pix2-code'");
  const openCellTabsIdx = renderTabsBody.indexOf('state.openCellTabs.forEach');

  assert(gridIdx !== -1 && animIdx !== -1 && sliceIdx !== -1 && codeIdx !== -1, 'All 4 primary tabs must exist');
  assert(gridIdx < animIdx, 'Grid Overview must precede Animation Studio');
  assert(animIdx < sliceIdx, 'Animation Studio must precede Import & Slice');
  assert(sliceIdx < codeIdx, 'Import & Slice must precede PIX2 Code & AI');
  assert(codeIdx < openCellTabsIdx, 'Cell editor tabs must be appended strictly after the 4 primary tabs');

  // B. Multi-project tabs contract
  assert(indexHtml.includes('id="project-tabs-strip"'), 'index.html must include #project-tabs-strip');
  assert(indexHtml.includes('id="btn-project-new-tab"'), 'index.html must include #btn-project-new-tab');
  assert(appJs.includes('persistAllProjectSessions'), 'app.js must implement persistAllProjectSessions()');
  assert(appJs.includes('noiradix_open_project_sessions'), 'app.js must persist sessions to localStorage');

  pass('Studio primary tab priority order and multi-project sessions invariants verified');
}

console.log('\n====================================================');
console.log(`ALL STUDIO 2.0 INTEGRATION TESTS PASSED (${passCount}/${passCount})`);
console.log('====================================================\n');
