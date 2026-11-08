// tests/test-modular-export.js
// Tests for Modular Sprite Pipeline & Structured Component Export (Mode A & Mode B)

const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const ModularExport = require('../js/modular-export.js');

console.log('====================================================');
console.log('RUNNING MODULAR COMPONENT EXPORT TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passCount++;
}

// Sample PIX2 1.1 Document with 2 cells and layered components
const sampleV11 = `@pix2 1.1

@meta
  title: "Modular Hero"
  author: "NOIRADIX"
  version: "1.1"

@grid
  columns: 2
  rows: 1
  default_cell: 16x16

@palette
  1: #333333
  2: #ff5555
  3: #55ff55

@cell hero_f0
  grid_pos: 0,0

@layer layer_body_0
  cell: hero_f0
  name: "Body"
  visible: true
  opacity: 1.0

@region reg_body_0
  cell: hero_f0
  parent: layer_body_0
  pixel 4,4 1 pixel 5,4 1

@layer layer_gear_0
  cell: hero_f0
  name: "Armor"
  visible: true
  opacity: 0.8

@region reg_armor_0
  cell: hero_f0
  parent: layer_gear_0
  pixel 4,5 2 pixel 5,5 2

@cell hero_f1
  grid_pos: 0,1

@layer layer_body_1
  cell: hero_f1
  name: "Body"
  visible: true
  opacity: 1.0

@region reg_body_1
  cell: hero_f1
  parent: layer_body_1
  pixel 4,3 1 pixel 5,3 1

@layer layer_gear_1
  cell: hero_f1
  name: "Armor"
  visible: true
  opacity: 0.8

@region reg_armor_1
  cell: hero_f1
  parent: layer_gear_1
  pixel 4,4 2 pixel 5,4 2

@animation run
  fps: 10
  loop: true
  action: run
  template: platformer_2dir
  frames: [hero_f0, hero_f1]

@end
`;

const doc = PIX2.parse(sampleV11);

// -----------------------------------------------------------------------------
// Test 1: Mode A (Composite Export) - Full Canvas
// -----------------------------------------------------------------------------
console.log('Test 1: Mode A (Composite Export) - Full Canvas Alignment');
const compRes = ModularExport.exportModularComponents(doc, {
  mode: 'composite',
  trimmed: false
});

assert.strictEqual(compRes.manifest.exportMode, 'composite');
assert.strictEqual(compRes.manifest.trimmed, false);
assert.strictEqual(compRes.manifest.components.length, 2, '2 cells exported as composite components');

const c0 = compRes.manifest.components[0];
assert.strictEqual(c0.id, 'hero_f0');
assert.strictEqual(c0.size.w, 16);
assert.strictEqual(c0.size.h, 16);
assert.strictEqual(c0.trimOffset, null, 'Full canvas mode must have null trimOffset');

const anim0 = compRes.manifest.animations[0];
assert.strictEqual(anim0.name, 'run');
assert.deepStrictEqual(anim0.frames, ['sprites/hero_f0.png', 'sprites/hero_f1.png']);

assert.ok(compRes.files.some(f => f.name === 'manifest.json'));
assert.ok(compRes.files.some(f => f.name === 'sprites/hero_f0.png'));
pass('Mode A exports composite images and manifest with full canvas alignment');

// -----------------------------------------------------------------------------
// Test 2: Mode A (Composite Export) - Trimmed Bounds
// -----------------------------------------------------------------------------
console.log('\nTest 2: Mode A (Composite Export) - Trimmed Bounds');
const compTrimRes = ModularExport.exportModularComponents(doc, {
  mode: 'composite',
  trimmed: true
});

assert.strictEqual(compTrimRes.manifest.trimmed, true);
const c0Trim = compTrimRes.manifest.components[0];
assert.ok(c0Trim.trimOffset, 'Trimmed export must include trimOffset metadata');
assert.strictEqual(c0Trim.trimOffset.x, 4);
assert.strictEqual(c0Trim.trimOffset.y, 4);
assert.strictEqual(c0Trim.trimOffset.w, 2);
assert.strictEqual(c0Trim.trimOffset.h, 2);
pass('Mode A with trimmed: true accurately crops transparent margins and records trimOffset');

// -----------------------------------------------------------------------------
// Test 3: Mode B (Modular Component Export)
// -----------------------------------------------------------------------------
console.log('\nTest 3: Mode B (Modular Component Export)');
const modRes = ModularExport.exportModularComponents(doc, {
  mode: 'modular',
  trimmed: false
});

assert.strictEqual(modRes.manifest.exportMode, 'modular');
// 2 cells x 2 layers = 4 component files
assert.strictEqual(modRes.manifest.components.length, 4);
assert.ok(modRes.files.some(f => f.name === 'components/hero_f0_layer_body_0.png'));
assert.ok(modRes.files.some(f => f.name === 'components/hero_f0_layer_gear_0.png'));

const modAnim = modRes.manifest.animations[0];
assert.ok(modAnim.components['Body'], 'Animation tracks Body layer frames');
assert.ok(modAnim.components['Armor'], 'Animation tracks Armor layer frames');
assert.strictEqual(modAnim.components['Body'].length, 2);
pass('Mode B exports granular components per layer and records per-layer animation tracks');

// -----------------------------------------------------------------------------
// Test 4: ZIP Archive Binary Integrity
// -----------------------------------------------------------------------------
console.log('\nTest 4: Pure JS ZIP Archive Generation');
const zipBuf = compRes.zip;
assert.ok(zipBuf && zipBuf.length > 50, 'ZIP buffer generated');
// Check ZIP local file header signature 0x04034b50
assert.strictEqual(zipBuf[0], 0x50);
assert.strictEqual(zipBuf[1], 0x4b);
assert.strictEqual(zipBuf[2], 0x03);
assert.strictEqual(zipBuf[3], 0x04);
pass('ZIP archive contains valid PKZIP local file headers without external dependencies');

console.log('\n====================================================');
console.log(`ALL MODULAR EXPORT TESTS PASSED (${passCount}/${passCount})`);
console.log('====================================================\n');
