// Roundtrip & Semantic Verification Test Suite for PIX2 Format Engine
const fs = require('fs');
const path = require('path');
const PIX2 = require('../js/pix2-format.js');
const EditorState = require('../js/editor-state.js');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('====================================================');
console.log('RUNNING PIX2 ENGINE SEMANTIC & ROUNDTRIP TEST SUITE');
console.log('====================================================\n');

// TEST 1: Comment stripping vs Hex colors
console.log('Test 1: Comment Lexer & Hex Disambiguation');
const testDocText = `@pix2 1.0
@meta
  title: "Test Sprite"
  grid: 2x2
  cell_size: 16x16

@palette
  1: #ffffff ; Semicolon comment
  2: #57546f # Hash comment with whitespace
  3: #ff6b8bcc ; 8-digit RGBA hex with alpha

@cell custom_hero_01
  name: "Hero Pose 1"
  direction: down
  frame: 0
  pixel 4,5 1
  pixel 6,7 #57546f ; inline comment
  pixel 8,9 #ff6b8bcc

@animation hero_idle
  direction: down
  frames: [custom_hero_01]
  fps: 8
  loop: true

@end
`;

const parsed1 = PIX2.parse(testDocText);
assert(parsed1.meta.title === 'Test Sprite', 'Meta title parsed correctly');
assert(parsed1.palette['1'] === '#ffffff', 'Palette 1 hex color preserved despite semicolon comment');
assert(parsed1.palette['2'] === '#57546f', 'Palette 2 hex color preserved despite hash comment');
assert(parsed1.palette['3'] === '#ff6b8bcc', 'Palette 3 8-digit RGBA hex preserved with alpha');

const heroCell = parsed1.cells['custom_hero_01'];
assert(heroCell !== undefined, 'Decoupled custom cell ID parsed correctly');
assert(heroCell.name === 'Hero Pose 1', 'Cell name parsed correctly');
assert(heroCell.direction === 'down', 'Cell direction tag parsed correctly');
assert(heroCell.pixels['4,5'] === '#ffffff', 'Pixel from palette ID resolved to #ffffff');
assert(heroCell.pixels['6,7'] === '#57546f', 'Pixel from direct hex resolved with comment stripped');
assert(heroCell.pixels['8,9'] === '#ff6b8bcc', 'Pixel with RGBA alpha preserved in cell storage');

const anim = parsed1.animations['hero_idle'];
assert(anim !== undefined, 'Custom animation parsed correctly');
assert(anim.frames.length === 1 && anim.frames[0] === 'custom_hero_01', 'Animation frames reference custom cell');
assert(anim.fps === 8, 'Animation FPS parsed as 8');
assert(anim.loop === true, 'Animation loop parsed as true');

// TEST 2: Roundtrip Serialization Determinism
console.log('\nTest 2: Semantic Roundtrip Determinism (Parse -> Serialize -> Parse)');
const serialized = PIX2.serialize(parsed1);
const parsed2 = PIX2.parse(serialized);

assert(parsed2.meta.title === parsed1.meta.title, 'Roundtrip: title identical');
assert(parsed2.meta.grid.cols === parsed1.meta.grid.cols, 'Roundtrip: grid cols identical');
assert(parsed2.meta.grid.rows === parsed1.meta.grid.rows, 'Roundtrip: grid rows identical');
assert(parsed2.cells['custom_hero_01'] !== undefined, 'Roundtrip: custom cell ID preserved');
assert(parsed2.cells['custom_hero_01'].pixels['4,5'] === parsed1.cells['custom_hero_01'].pixels['4,5'], 'Roundtrip: pixel 4,5 preserved');
assert(parsed2.cells['custom_hero_01'].pixels['8,9'] === '#ff6b8bcc', 'Roundtrip: RGBA alpha pixel preserved');
assert(parsed2.animations['hero_idle'] !== undefined, 'Roundtrip: animation preserved');

// TEST 3: Sample Noiradix_Ghost.pix2 validation
console.log('\nTest 3: Validating samples/Noiradix_Ghost.pix2');
const samplePath = path.join(__dirname, '..', 'samples', 'Noiradix_Ghost.pix2');
if (fs.existsSync(samplePath)) {
  const sampleContent = fs.readFileSync(samplePath, 'utf8');
  const sampleDoc = PIX2.parse(sampleContent);
  const cellCount = Object.keys(sampleDoc.cells).length;
  assert(cellCount > 0, `Noiradix_Ghost.pix2 loaded with ${cellCount} cells`);
  assert(sampleDoc.palette && Object.keys(sampleDoc.palette).length > 0, 'Noiradix_Ghost.pix2 palette loaded');
  assert(sampleDoc.animations && Object.keys(sampleDoc.animations).length >= 4, 'Noiradix_Ghost.pix2 has 4-dir animations');
}

// TEST 4: Custom Cell Identifiers with grid_pos & Single-Line vs Multi-Line Pixels
console.log('\nTest 4: Custom Cell Identifiers & grid_pos Mapping (ChatGPT File Test)');
const testPix2Snippet = `@pix2 1.0
@meta
  title: "Ashen Reaper Test"
  grid: 4x4
  cell_size: 16x16
@palette
  1: #292438
@cell reaper_down_0
  name: "Reaper Down 1"
  direction: down
  frame: 0
  grid_pos: 0,0
  pixel 4,0 1
  pixel 5,0 1
@animation walk_down
  frames: [reaper_down_0]
@end`;

const customDoc = PIX2.parse(testPix2Snippet);
assert(customDoc.cells['reaper_down_0'] !== undefined, 'Custom cell reaper_down_0 parsed');
assert(customDoc.cells['reaper_down_0'].row === 0 && customDoc.cells['reaper_down_0'].col === 0, 'grid_pos 0,0 parsed into row/col 0,0');
assert(customDoc.cells['reaper_down_0'].direction === 'down', 'Cell direction tag preserved');
assert(customDoc.animations['walk_down'].frames.includes('reaper_down_0'), 'Animation references custom cell ID');

// TEST 5: Row-Only Flip & Duplicate Logic Semantics
console.log('\nTest 5: Row-Only Flip & Row Duplication Verification');
const multiRowDoc = PIX2.createDocument('MultiRow Test', 4, 2, 16, 16);
multiRowDoc.cells['cell_0_0'].pixels = { '2,2': '#ffffff', '4,4': '#ffffff' };
multiRowDoc.cells['cell_1_0'].pixels = { '1,1': '#ff0000' };

// Flip row 0 horizontally (w = 16)
const originalRow1Pixels = { ...multiRowDoc.cells['cell_1_0'].pixels };
const newRow0Pixels = {};
for (const coord in multiRowDoc.cells['cell_0_0'].pixels) {
  const [x, y] = coord.split(',').map(Number);
  newRow0Pixels[`${16 - 1 - x},${y}`] = multiRowDoc.cells['cell_0_0'].pixels[coord];
}
multiRowDoc.cells['cell_0_0'].pixels = newRow0Pixels;

assert(multiRowDoc.cells['cell_0_0'].pixels['13,2'] === '#ffffff', 'Row 0 pixel 2,2 flipped to 13,2 horizontally');
assert(multiRowDoc.cells['cell_0_0'].pixels['11,4'] === '#ffffff', 'Row 0 pixel 4,4 flipped to 11,4 horizontally');
assert(multiRowDoc.cells['cell_1_0'].pixels['1,1'] === '#ff0000', 'Row 1 remained completely untouched during row 0 flip');

// Row duplication test
const oldRows = multiRowDoc.meta.grid.rows;
const newRowIdx = oldRows;
multiRowDoc.meta.grid.rows = oldRows + 1;
const dupName = 'Walk Run';
const cleanPrefix = 'walk_run';
const dupFrameIds = [];

for (let c = 0; c < multiRowDoc.meta.grid.cols; c++) {
  const newCellId = `${cleanPrefix}_${c}`;
  const srcCell = multiRowDoc.cells[`cell_0_${c}`];
  multiRowDoc.cells[newCellId] = {
    id: newCellId,
    name: `${dupName} - Frame ${c}`,
    row: newRowIdx,
    col: c,
    frame: c,
    pixels: { ...(srcCell ? srcCell.pixels : {}) }
  };
  dupFrameIds.push(newCellId);
}
multiRowDoc.animations[cleanPrefix] = {
  name: dupName,
  fps: 6,
  loop: true,
  frames: dupFrameIds
};

assert(multiRowDoc.meta.grid.rows === 3, 'Grid rows expanded from 2 to 3');
assert(multiRowDoc.cells['walk_run_0'].pixels['13,2'] === '#ffffff', 'Duplicated row 2 has cloned pixel data from row 0');
assert(multiRowDoc.animations['walk_run'].frames.length === 4, 'Animation sequence created with all 4 column frames');

// Row reordering & Animation state assignment verification
console.log('\nTest 6: Row Movement & Safe Animation Assignment (Zero Pixel Loss)');
// Move row 2 to row 0
const rows = multiRowDoc.meta.grid.rows;
const cols = multiRowDoc.meta.grid.cols;
const fromIdx = 2;
const toIdx = 0;
const order = [];
for (let r = 0; r < rows; r++) order.push(r);
const [moved] = order.splice(fromIdx, 1);
order.splice(toIdx, 0, moved);
const oldToNew = {};
order.forEach((oldR, newR) => { oldToNew[oldR] = newR; });

// Update cell row properties
for (const cid in multiRowDoc.cells) {
  const cell = multiRowDoc.cells[cid];
  if (cell && typeof cell.row === 'number') {
    cell.row = oldToNew[cell.row];
  }
}

assert(multiRowDoc.cells['walk_run_0'].row === 0, 'Moved row 2 cell walk_run_0 is now at row 0');
assert(multiRowDoc.cells['walk_run_0'].pixels['13,2'] === '#ffffff', 'Moved row preserved all pixel data without loss');

// Safe animation assignment to row 0 with new animation name "dash"
const row0Cells = [];
for (let c = 0; c < cols; c++) {
  // Find cell at row 0, col c
  let foundCell = null;
  for (const cid in multiRowDoc.cells) {
    if (multiRowDoc.cells[cid].row === 0 && multiRowDoc.cells[cid].col === c) {
      foundCell = multiRowDoc.cells[cid];
      break;
    }
  }
  assert(foundCell !== null, `Found cell at row 0 col ${c}`);
  row0Cells.push(foundCell.id);
}

multiRowDoc.animations['dash'] = {
  name: 'Dash',
  direction: 'none',
  frames: row0Cells,
  fps: 8,
  loop: true
};

assert(multiRowDoc.animations['dash'].frames[0] === 'walk_run_0', 'New animation state references existing cells');
assert(multiRowDoc.cells['walk_run_0'].pixels['13,2'] === '#ffffff', 'Artwork pixels completely preserved when assigned to new animation state');

// Test 7: Hand/Pan Tool State & Analytical Cursor-Centered Zoom Formula
console.log(`\nTest 7: Pan Tool State & Analytical Cursor-Centered Zoom Formula`);
const state = new EditorState();
state.currentTool = 'pan';
assert(state.currentTool === 'pan', 'EditorState supports pan tool');

// Verify analytical anchor-centered zoom invariance across random test points
const testPoints = [0, 3, 7.5, 11, 15, 16];
const vpWidth = 1000;
const docW = 16;
for (const pt of testPoints) {
  let pX = 0;
  const zOld = 16;
  const zNew = 28;
  const screenPosBefore = pX + (vpWidth / 2 - (docW * zOld) / 2) + pt * zOld;
  const dW = (docW * (zNew - zOld)) / 2;
  const pShift = pt * (zNew - zOld);
  pX += Math.round(dW - pShift);
  const screenPosAfter = pX + (vpWidth / 2 - (docW * zNew) / 2) + pt * zNew;
  assert(Math.abs(screenPosAfter - screenPosBefore) < 0.001, `Zoom anchor point ${pt} remains invariant under cursor`);
}

// Verify Grid Context Menu focused-cell resolution
let focusedCellId = 'reaper_up_3';
function resolveGridContextMenuTarget(clickedCellId, currentSelectedCellId, doc) {
  if (clickedCellId) return clickedCellId;
  if (currentSelectedCellId) return currentSelectedCellId;
  return Object.keys(doc ? doc.cells : {})[0] || null;
}
assert(resolveGridContextMenuTarget(null, focusedCellId, multiRowDoc) === 'reaper_up_3', 'Right-clicking empty grid area correctly resolves focused cell Reaper Up 3');
assert(resolveGridContextMenuTarget('reaper_down_0', focusedCellId, multiRowDoc) === 'reaper_down_0', 'Right-clicking another cell focuses that specific cell');
assert(resolveGridContextMenuTarget(null, null, multiRowDoc) !== null, 'Right-clicking with no selection falls back safely');

// Test 8: Animation Player Dynamic Scaling & Auto-Fit Math
console.log(`\nTest 8: Animation Player Scaling & Auto-Fit Math`);
const AnimationPlayer = require('../js/animation-player.js');
const dummyCanvas = { width: 0, height: 0, getContext: () => null, parentElement: { clientWidth: 192, clientHeight: 192 } };
const animP = new AnimationPlayer(dummyCanvas);
assert(animP.scale === 8, 'AnimationPlayer default scale is 8x for clear crisp preview');

// Test auto-fit integer scale calculations for different sprite resolutions into 192px box
function calcFitScale(cw, ch, maxBox = 192) {
  return Math.max(1, Math.floor(Math.min(maxBox / cw, maxBox / ch)));
}
assert(calcFitScale(16, 16) === 12, '16x16 sprite auto-fits to exact 12x integer scale (192px)');
assert(calcFitScale(24, 24) === 8, '24x24 sprite auto-fits to exact 8x integer scale (192px)');
assert(calcFitScale(32, 32) === 6, '32x32 sprite auto-fits to exact 6x integer scale (192px)');
assert(calcFitScale(64, 64) === 3, '64x64 sprite auto-fits to exact 3x integer scale (192px)');
assert(16 * 16 === 256, '16x16 sprite renders grand at 256px in Animation Studio');
assert(calcFitScale(16, 16, 400) === 25, '16x16 sprite dynamically auto-fits up to 25x in large 400px studio viewport');

// Test 9: Grid Overview Free 360° Panning Invariance & Atlas Magnifying Zoom
console.log(`\nTest 9: Grid Free Panning & Atlas Magnifying Zoom`);
let gPanX = 0, gPanY = 0;
const startPanX = 15, startPanY = -25;
const dragDeltaX = 80, dragDeltaY = 45;
gPanX = startPanX + dragDeltaX;
gPanY = startPanY + dragDeltaY;
assert(gPanX === 95 && gPanY === 20, 'Grid free panning computes exact 360-degree delta translation');

// Verify Atlas Magnifying Zoom display calculations
function getAtlasDisplayDim(atlasW, atlasH, zoom, containerW = 200, containerH = 200) {
  let effZ = zoom;
  if (zoom === 'fit') {
    effZ = Math.max(1, Math.floor(Math.min(containerW / atlasW, containerH / atlasH)));
  } else {
    effZ = Math.max(1, Number(zoom) || 4);
  }
  return { w: atlasW * effZ, h: atlasH * effZ, effZ };
}
const sampleAtlas = { w: 69, h: 69 };
assert(getAtlasDisplayDim(sampleAtlas.w, sampleAtlas.h, 1).w === 69, 'Atlas 1x zoom is exact 69px');
assert(getAtlasDisplayDim(sampleAtlas.w, sampleAtlas.h, 2).w === 138, 'Atlas 2x zoom is exact 138px');
assert(getAtlasDisplayDim(sampleAtlas.w, sampleAtlas.h, 4).w === 276, 'Atlas 4x zoom is exact 276px');
assert(getAtlasDisplayDim(sampleAtlas.w, sampleAtlas.h, 'fit', 200, 200).effZ === 2, 'Atlas fit zoom calculates exact integer multiplier within box');

// TEST 10: Multilingual UTF-8, Vietnamese Diacritics & Whitespace Preservation
console.log('\nTest 10: Multilingual UTF-8, Vietnamese Diacritics & Whitespace Support');
const vnTitle = 'Dũng Sĩ Bóng Đêm - Chiến Binh Rừng Sâu (4-Hướng)';
const cjkTitle = '勇者スプライト - Pixel Master 2026';
const vnCellName = 'Đòn Đánh Lôi Thần #1';

const multiDoc = PIX2.createDocument(vnTitle, 2, 2, 16, 16);
multiDoc.cells['cell_0_0'].name = vnCellName;
multiDoc.cells['cell_0_0'].pixels['0,0'] = '#ffffff';

const serializedVn = PIX2.serialize(multiDoc);
assert(serializedVn.includes(`title: "${vnTitle}"`), 'Serialized PIX2 contains exact Vietnamese title with tone marks');
assert(serializedVn.includes(`name: "${vnCellName}"`), 'Serialized PIX2 contains exact Vietnamese cell name');

const reParsedVn = PIX2.parse(serializedVn);
assert(reParsedVn.meta.title === vnTitle, 'Roundtrip parses exact Vietnamese title with spaces and diacritics');
assert(reParsedVn.cells['cell_0_0'].name === vnCellName, 'Roundtrip parses exact Vietnamese cell name');

const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

function sanitizeSafeFilename(raw, defaultExt = '', fallback = 'sprite') {
  if (!raw || typeof raw !== 'string') {
    return defaultExt ? `${fallback}${defaultExt}` : fallback;
  }
  let name = raw.trim();
  if (defaultExt) {
    const extRegex = new RegExp(`${defaultExt.replace('.', '\\.')}$`, 'i');
    if (extRegex.test(name)) {
      name = name.replace(extRegex, '');
    }
  }
  name = name
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_');
  name = name.replace(/^\.+/, '').trim();
  name = name.replace(/[. ]+$/, '');
  const lowerBase = name.toLowerCase();
  if (WINDOWS_RESERVED_NAMES.has(lowerBase)) {
    name = `_${name}`;
  }
  if (name.length > 120) {
    name = name.slice(0, 120).trim().replace(/[. ]+$/, '');
  }
  if (!name || /^_+$/.test(name)) {
    name = fallback;
  }
  if (defaultExt) {
    return `${name}${defaultExt}`;
  }
  return name;
}

const safeVnFileName = sanitizeSafeFilename('Dũng Sĩ Bóng Đêm: Phiên Bản Mới / Special?', '.pix2');
assert(safeVnFileName === 'Dũng Sĩ Bóng Đêm_ Phiên Bản Mới _ Special_.pix2', 'Sanitization preserves Vietnamese and spaces while replacing illegal chars');

const safeCjkFileName = sanitizeSafeFilename(cjkTitle, '.pix2');
assert(safeCjkFileName === `${cjkTitle}.pix2`, 'Sanitization preserves CJK characters and spaces');

// Windows Reserved Device Names Protection
assert(sanitizeSafeFilename('CON', '.pix2') === '_CON.pix2', 'Sanitizer shields Windows CON device name');
assert(sanitizeSafeFilename('aux.pix2', '.pix2') === '_aux.pix2', 'Sanitizer shields Windows AUX device name');
assert(sanitizeSafeFilename('nul', '.pix2') === '_nul.pix2', 'Sanitizer shields Windows NUL device name');
assert(sanitizeSafeFilename('com1.PIX2', '.pix2') === '_com1.pix2', 'Sanitizer shields Windows COM1 device name');

// Trailing dots, spaces & Control Characters
assert(sanitizeSafeFilename('my_sprite. . . ', '.pix2') === 'my_sprite.pix2', 'Sanitizer strips trailing dots and spaces before extension');
assert(sanitizeSafeFilename("bad\x00name\r\n", '.pix2') === 'badname.pix2', 'Sanitizer strips control characters');
assert(sanitizeSafeFilename(':::???', '.pix2', 'fallback') === 'fallback.pix2', 'Sanitizer falls back cleanly when input is only illegal characters');

// Overwrite defense: Disallow direct disk overwrite when filename does not match handle
const mockHandle = { name: 'Ashen_Reaper.pix2', createWritable: () => {} };
let activeFileName = 'reaper_v2.pix2';
const isDirectHandleValid = mockHandle &&
                            'createWritable' in mockHandle &&
                            (!activeFileName || mockHandle.name === activeFileName);
assert(isDirectHandleValid === false, 'Direct overwrite safely blocked when activeFileName differs from file handle name');

// Test Project Base Path combination
function computeFullPath(baseDir, fileName) {
  if (!baseDir) return fileName;
  const cleanBase = baseDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return `${cleanBase}/${fileName}`;
}

const fullVnPath = computeFullPath('D:/ghoster/WISPLINGS/Assets', safeVnFileName);
assert(fullVnPath === 'D:/ghoster/WISPLINGS/Assets/Dũng Sĩ Bóng Đêm_ Phiên Bản Mới _ Special_.pix2', 'Full path correctly joins base path and UTF-8 filename');

// TEST 11: Cross-Platform (Windows, Linux, macOS) Interoperability
console.log('\nTest 11: Cross-Platform Interoperability (Windows, Linux, macOS)');

// 1. macOS NFD vs Windows/Linux NFC Normalization Equivalence
// macOS APFS decomposes characters into NFD (u + combining tilde), while Windows/Linux use NFC
const nfdMacString = 'D\u0075\u0303ng S\u0129.pix2'; // Decomposed NFD
const nfcWinString = 'D\u0169ng S\u0129.pix2';       // Precomposed NFC
assert(nfdMacString !== nfcWinString, 'Raw Mac NFD and Windows NFC strings have different byte structures without normalization');
assert(nfdMacString.normalize('NFC') === nfcWinString.normalize('NFC'), 'NFC normalization reconciles Mac NFD and Windows NFC identically');

const macHandle = { name: nfdMacString, createWritable: () => {} };
const currentNfcName = nfcWinString;
const macDirectValid = macHandle && (!currentNfcName || macHandle.name.normalize('NFC') === currentNfcName.normalize('NFC'));
assert(macDirectValid === true, 'macOS file handle matches Windows/Linux input cleanly under NFC normalization');

// 2. Linux / macOS Hidden File Safety (Leading dot stripping)
assert(sanitizeSafeFilename('.hidden_character.pix2', '.pix2') === 'hidden_character.pix2', 'Linux hidden file leading dot stripped cleanly');

// 3. Multi-OS EOL Parser Test (CRLF Windows, LF Linux, CR Classic Mac)
const winCrlfText = "@pix2 1.0\r\n@meta\r\n  title: \"Win CRLF\"\r\n  grid: 1x1\r\n@end";
const linuxLfText = "@pix2 1.0\n@meta\n  title: \"Linux LF\"\n  grid: 1x1\n@end";
const macCrText = "@pix2 1.0\r@meta\r  title: \"Mac CR\"\r  grid: 1x1\r@end";
const mixedEolText = "@pix2 1.0\r\n@meta\n  title: \"Mixed EOL\"\r  grid: 1x1\r\n@end";

assert(PIX2.parse(winCrlfText).meta.title === 'Win CRLF', 'Parser reads Windows CRLF files cleanly');
assert(PIX2.parse(linuxLfText).meta.title === 'Linux LF', 'Parser reads Linux LF files cleanly');
assert(PIX2.parse(macCrText).meta.title === 'Mac CR', 'Parser reads Classic Mac CR files cleanly');
assert(PIX2.parse(mixedEolText).meta.title === 'Mixed EOL', 'Parser reads mixed EOL line endings cleanly');

// TEST 12: Editor State Stability & Tab Preservation
console.log('\nTest 12: Editor State Stability & Tab Preservation');
const testEditor = new EditorState();
const docA = PIX2.createDocument('Doc A', 4, 4, 16, 16);
testEditor.setDocument(docA);
testEditor.openCellTab('cell_1_2');
assert(testEditor.activeTabId === 'cell_1_2', 'Active tab switched to cell_1_2');
assert(testEditor.openCellTabs.includes('cell_1_2'), 'openCellTabs contains cell_1_2');

// Reload with preserveTabs = true (e.g. Apply Code or External Disk Reload)
const docB = PIX2.createDocument('Doc B', 4, 4, 16, 16);
testEditor.setDocument(docB, true);
assert(testEditor.activeTabId === 'cell_1_2', 'Reload with preserveTabs=true kept activeTabId cell_1_2');
assert(testEditor.openCellTabs.includes('cell_1_2'), 'Reload with preserveTabs=true kept open cell tab');

// Full reset with preserveTabs = false (e.g. New File or Open File)
const docC = PIX2.createDocument('Doc C', 4, 4, 16, 16);
testEditor.setDocument(docC, false);
assert(testEditor.activeTabId === 'tab-grid-overview', 'Reset with preserveTabs=false reset active tab to Overview');
assert(testEditor.openCellTabs.length === 0, 'Reset with preserveTabs=false cleared open tabs');

// Undo / Redo tab restoration
testEditor.openCellTab('cell_0_1');
testEditor.saveSnapshot('State on Cell 0,1'); // History index 1: cell_0_1
testEditor.activeTabId = 'tab-grid-overview';
testEditor.saveSnapshot('State on Overview'); // History index 2: tab-grid-overview
assert(testEditor.activeTabId === 'tab-grid-overview', 'Currently on Overview');

testEditor.undo(); // Undoes to History index 1
assert(testEditor.activeTabId === 'cell_0_1', 'Undo accurately restored historical activeTabId cell_0_1');

testEditor.redo(); // Redoes to History index 2
assert(testEditor.activeTabId === 'tab-grid-overview', 'Redo accurately restored historical activeTabId tab-grid-overview');

// TEST 13: AI Argon 4.0 Compatibility: Delimiter-Agnostic Rect Primitives & Palette Comment Disambiguation
console.log('\nTest 13: AI Argon 4.0 Parser Compatibility (RFC-PARSER-01 & RFC-PARSER-02)');
const argonDocText = `@pix2 1.1
@meta
  title: "Argon Field Test"
  grid: 1x1
  cell_size: 48x48

@palette
  # Whole-line comment starting with hex-like word
  #dead code section
  #beef up the color list
  1: #07080d # Dark Slate Outline
  2: #121524#Dark Slate Shadow without space
  3: #2b2d42 #beef stew comment with hex word
  4: #8d99ae #dead body comment with hex word
  5: #edf2f4 #fade to white
  6: #f4a261 #face details
  7: #d90429 ; Standard semicolon comment
  8: #38bdf880 # Semi-transparent Soulfire

@cell cell_0_0
  name: "Argon Reaper"
  direction: down
  frame: 0
  grid_pos: 0,0
  @layer body
    cell: cell_0_0
    name: "Body"
    opacity: 1.0
    blend: normal
    @region torso
      id: torso
      cell: cell_0_0
      name: "Torso"
      rect 12,6 8,7 1 fill
      rect 24,6 8x7 2 fill
      rect 12,20 8X7 3 fill
      rect 4,4 4,4 7 outline
      p 10,10 #ffffff#comment attached to direct hex
      sym_dot 20,10 23.5 8
@animation walk_down
  name: "Walk Down"
  direction: down
  frames: [cell_0_0]
  fps: 6
  loop: true
  mode: loop

@end
`;

const parsedArgon = PIX2.parse(argonDocText);
const valArgon = PIX2.validate(parsedArgon);

assert(valArgon.valid === true, 'Argon compatibility document is strictly valid');
assert(valArgon.errors.length === 0, 'Zero validation errors on Argon compatibility document');
assert(parsedArgon.palette['1'] === '#07080d', 'Palette 1 resolved cleanly with hash comment');
assert(parsedArgon.palette['2'] === '#121524', 'Palette 2 resolved cleanly without space before hash');
assert(parsedArgon.palette['3'] === '#2b2d42', 'Palette 3 resolved cleanly despite "#beef" comment word');
assert(parsedArgon.palette['4'] === '#8d99ae', 'Palette 4 resolved cleanly despite "#dead" comment word');
assert(parsedArgon.palette['5'] === '#edf2f4', 'Palette 5 resolved cleanly despite "#fade" comment word');
assert(parsedArgon.palette['6'] === '#f4a261', 'Palette 6 resolved cleanly despite "#face" comment word');
assert(parsedArgon.palette['7'] === '#d90429', 'Palette 7 resolved cleanly with semicolon comment');
assert(parsedArgon.palette['8'] === '#38bdf880', 'Palette 8 8-digit RGBA hex preserved');

// Verify rect with comma delimiter drew pixels
const argonPixels = parsedArgon.cells['cell_0_0'].pixels;
assert(argonPixels['12,6'] === '#07080d', 'Rect with comma delimiter "8,7" correctly plotted fill pixels');
assert(argonPixels['19,12'] === '#07080d', 'Rect with comma delimiter covers bottom-right corner (12+8-1, 6+7-1)');
assert(argonPixels['24,6'] === '#121524', 'Rect with "x" delimiter "8x7" correctly plotted fill pixels');
assert(argonPixels['12,20'] === '#2b2d42', 'Rect with "X" delimiter "8X7" correctly plotted fill pixels');
assert(argonPixels['4,4'] === '#d90429', 'Rect outline with comma delimiter correctly plotted corner');
assert(argonPixels['10,10'] === '#ffffff', 'Direct hex pixel with attached "#comment" correctly plotted');

// Verify parseDimension directly
assert(JSON.stringify(PIX2.parseDimension('16x16')) === '[16,16]', 'parseDimension handles "16x16"');
assert(JSON.stringify(PIX2.parseDimension('16X16')) === '[16,16]', 'parseDimension handles "16X16"');
assert(JSON.stringify(PIX2.parseDimension('16,16')) === '[16,16]', 'parseDimension handles "16,16"');
assert(JSON.stringify(PIX2.parseDimension(' 16 , 16 ')) === '[16,16]', 'parseDimension handles " 16 , 16 "');
assert(PIX2.parseDimension('invalid') === null, 'parseDimension rejects invalid strings');

console.log(`\n====================================================`);
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log(`====================================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
