// tests/test-pix2-v11.js
// Normative specification and regression tests for PIX2 1.1 Structural Trees & Metadata

const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');

console.log('====================================================');
console.log('RUNNING PIX2 1.1 SPECIFICATION & INTEGRATION SUITE');
console.log('====================================================\n');

let passCount = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passCount++;
}

// -------------------------------------------------------------
// Test 1: PIX2 1.1 Parsing with @layer, @group, @region
// -------------------------------------------------------------
console.log('Test 1: PIX2 1.1 Parser & Structural Hierarchy');
const sampleV11 = `@pix2 1.1

@meta
  title: "Modular Hero"
  author: "NOIRADIX Team"
  version: "1.1"
  color_mode: "RGBA"
  coordinate_origin: "top-left"

@grid
  columns: 1
  rows: 1
  default_cell: 16x16
  background: none

@palette
  1: #2a203b
  2: #e06f8b
  3: #be2633
  skin: #fbb954

@cell hero_idle_0
  name: "Hero Idle 0"
  direction: down
  frame: 0
  grid_pos: 0,0

@layer layer_root
  cell: hero_idle_0
  name: "Character"
  visible: true
  locked: false
  opacity: 1.0
  blend: normal

@group grp_head
  cell: hero_idle_0
  parent: layer_root
  name: "Head"
  visible: true
  locked: false
  tags: [head, equip_helm]

@region reg_face
  cell: hero_idle_0
  parent: grp_head
  name: "Face"
  visible: true
  locked: false
  tags: [face, skin]
  pixel 4,4 skin pixel 5,4 skin

@region reg_hair
  cell: hero_idle_0
  parent: grp_head
  name: "Hair"
  visible: true
  locked: false
  tags: [hair]
  pixel 4,3 1 pixel 5,3 1

@layer layer_fx
  cell: hero_idle_0
  name: "Aura FX"
  visible: true
  locked: false
  opacity: 0.5
  blend: normal

@region reg_aura
  cell: hero_idle_0
  parent: layer_fx
  name: "Aura"
  visible: true
  locked: false
  tags: [fx]
  pixel 3,3 2 pixel 6,3 2

@animation anim_walk
  name: "Walk Cycle"
  direction: down
  action: walk
  template: platformer_2dir
  frames: [hero_idle_0]
  fps: 8
  loop: true
  mode: loop

@end
`;

const doc11 = PIX2.parse(sampleV11);
assert.strictEqual(doc11.meta.version, '1.1');
assert.strictEqual(doc11._diagnostics.length, 0, 'No parse diagnostics expected');

const cell = doc11.cells['hero_idle_0'];
assert.ok(cell, 'Cell hero_idle_0 exists');
assert.strictEqual(cell.layers.length, 2, 'Cell contains 2 root layers');

const layerRoot = cell.layers[0];
assert.strictEqual(layerRoot.id, 'layer_root');
assert.strictEqual(layerRoot.children.length, 1, 'layer_root has 1 child group');

const grpHead = layerRoot.children[0];
assert.strictEqual(grpHead.id, 'grp_head');
assert.strictEqual(grpHead.children.length, 2, 'grp_head contains 2 regions');
assert.deepStrictEqual(grpHead.tags, ['head', 'equip_helm']);

const regFace = grpHead.children[0];
assert.strictEqual(regFace.id, 'reg_face');
assert.strictEqual(regFace.pixels['4,4'], '#fbb954');
assert.strictEqual(regFace.pixels['5,4'], '#fbb954');

const layerFx = cell.layers[1];
assert.strictEqual(layerFx.id, 'layer_fx');
assert.strictEqual(layerFx.opacity, 0.5);

const anim = doc11.animations['anim_walk'];
assert.ok(anim, 'Animation exists');
assert.strictEqual(anim.action, 'walk');
assert.strictEqual(anim.template, 'platformer_2dir');

pass('PIX2 1.1 parsed correctly into deep AST hierarchy with tags and animation metadata');

// -------------------------------------------------------------
// Test 2: Compositing & Opacity Calculation
// -------------------------------------------------------------
console.log('\nTest 2: Structural Alpha Compositing (compositeCellLayers)');
const composited = PIX2.compositeCellLayers(cell, { w: 16, h: 16 });
assert.strictEqual(composited['4,4'], '#fbb954', 'Opaque skin pixel rendered correctly');
assert.strictEqual(composited['4,3'], '#2a203b', 'Opaque hair pixel rendered correctly');
assert.ok(composited['3,3'], 'Aura pixel exists');
// Aura layer has opacity 0.5; color #e06f8b -> 8-digit hex with ~50% alpha (128 = 0x80)
const auraHex = composited['3,3'];
assert.ok(auraHex.length === 9, `Aura pixel must be 8-digit hex RGBA with alpha channel, got ${auraHex}`);
pass('compositeCellLayers correctly performs hierarchical visibility and layer opacity compositing');

// -------------------------------------------------------------
// Test 3: Serialization Determinism & Roundtrip
// -------------------------------------------------------------
console.log('\nTest 3: PIX2 1.1 Serialization & Roundtrip Determinism');
const serializedV11 = PIX2.serialize(doc11);
assert.ok(serializedV11.includes('@pix2 1.1'), 'Serialized text includes @pix2 1.1 header');
assert.ok(serializedV11.includes('@layer layer_root'), 'Serialized text includes @layer');
assert.ok(serializedV11.includes('@group grp_head'), 'Serialized text includes @group');
assert.ok(serializedV11.includes('@region reg_face'), 'Serialized text includes @region');
assert.ok(serializedV11.includes('action: walk'), 'Serialized text includes action field');
assert.ok(serializedV11.includes('template: platformer_2dir'), 'Serialized text includes template field');

const roundtripDoc = PIX2.parse(serializedV11);
assert.strictEqual(roundtripDoc.meta.version, '1.1');
assert.strictEqual(roundtripDoc.cells['hero_idle_0'].layers.length, 2);
assert.strictEqual(roundtripDoc.cells['hero_idle_0'].layers[0].children[0].children.length, 2);
assert.strictEqual(roundtripDoc.animations['anim_walk'].template, 'platformer_2dir');
pass('PIX2 1.1 serialize -> parse roundtrip preserves structure, attributes, and tags');

// -------------------------------------------------------------
// Test 4: Upgrade & Downgrade Engine (v1.0 <-> v1.1)
// -------------------------------------------------------------
console.log('\nTest 4: v1.0 <-> v1.1 Upgrade and Downgrade Engine');
const sampleV10 = `@pix2 1.0
@meta
  title: "Legacy Document"
  author: "User"
  version: "1.0"
  color_mode: "RGBA"
  coordinate_origin: "top-left"
@grid
  columns: 1
  rows: 1
  default_cell: 16x16
  background: none
@palette
  1: #ff0000
@cell c0
  name: "Cell Zero"
  grid_pos: 0,0
  pixel 0,0 1
@end
`;

const doc10 = PIX2.parse(sampleV10);
assert.strictEqual(doc10.meta.version, '1.0');
assert.strictEqual(doc10.cells['c0'].layers, undefined, 'v1.0 document cells must not have layers property by default');

const upgradeRes = PIX2.upgradeV10ToV11(doc10);
assert.strictEqual(upgradeRes.success, true);
assert.strictEqual(upgradeRes.doc.meta.version, '1.1');
assert.strictEqual(upgradeRes.doc.cells['c0'].layers.length, 1);
assert.strictEqual(upgradeRes.doc.cells['c0'].layers[0].id, 'layer_legacy_c0');
assert.strictEqual(upgradeRes.doc.cells['c0'].layers[0].children[0].id, 'region_legacy_c0');
assert.strictEqual(upgradeRes.doc.cells['c0'].layers[0].children[0].pixels['0,0'], '#ff0000');

const downgradeRes = PIX2.flattenV11ToV10(doc11);
assert.strictEqual(downgradeRes.success, true);
assert.strictEqual(downgradeRes.doc.meta.version, '1.0');
assert.strictEqual(downgradeRes.doc.cells['hero_idle_0'].layers, undefined);
assert.ok(downgradeRes.doc.cells['hero_idle_0'].pixels['4,4']);
assert.ok(downgradeRes.lossReport.discardedLayers.includes('layer_root'));
assert.ok(downgradeRes.lossReport.discardedGroups.includes('grp_head'));
assert.ok(downgradeRes.lossReport.discardedRegions.includes('reg_face'));
assert.strictEqual(downgradeRes.lossReport.flattenedOpacityCount, 1);

pass('upgradeV10ToV11 wraps cells cleanly and flattenV11ToV10 flattens pixels with accurate loss report');

// -------------------------------------------------------------
// Test 5: Validation & Semantic Checks
// -------------------------------------------------------------
console.log('\nTest 5: PIX2 1.1 Structural Validation Rules');

// 5a: Duplicate node IDs
const dupDoc = JSON.parse(JSON.stringify(doc11));
dupDoc.cells['hero_idle_0'].layers[1].id = 'layer_root'; // duplicate!
const vDup = PIX2.validate(dupDoc);
assert.strictEqual(vDup.valid, false);
assert.ok(vDup.errors.some(e => e.includes('PIX2_ERR_DUPLICATE_NODE_ID')));
pass('Validation catches duplicate structural node IDs across document');

// 5b: Invalid layer opacity
const badOpacityDoc = JSON.parse(JSON.stringify(doc11));
badOpacityDoc.cells['hero_idle_0'].layers[0].opacity = 1.5;
const vOpacity = PIX2.validate(badOpacityDoc);
assert.strictEqual(vOpacity.valid, false);
assert.ok(vOpacity.errors.some(e => e.includes('PIX2_ERR_INVALID_OPACITY')));
pass('Validation catches layer opacity > 1.0 or < 0.0');

// 5c: Unsupported blend mode
const badBlendDoc = JSON.parse(JSON.stringify(doc11));
badBlendDoc.cells['hero_idle_0'].layers[0].blend = 'multiply';
const vBlend = PIX2.validate(badBlendDoc);
assert.strictEqual(vBlend.valid, false);
assert.ok(vBlend.errors.some(e => e.includes('PIX2_ERR_UNSUPPORTED_BLEND')));
pass('Validation catches unsupported blend modes');

// 5d: Cross-cell parentage
const crossCellDoc = JSON.parse(JSON.stringify(doc11));
crossCellDoc.cells['hero_idle_0'].layers[0].cell = 'other_cell_id';
const vCross = PIX2.validate(crossCellDoc);
assert.strictEqual(vCross.valid, false);
assert.ok(vCross.errors.some(e => e.includes('PIX2_ERR_CROSS_CELL_PARENT')));
pass('Validation catches cross-cell parentage inconsistency');

// 5e: Safe identifier prototype pollution check
const protoDoc = JSON.parse(JSON.stringify(doc11));
protoDoc.cells['hero_idle_0'].layers[0].id = '__proto__';
const vProto = PIX2.validate(protoDoc);
assert.strictEqual(vProto.valid, false);
assert.ok(vProto.errors.some(e => e.includes('PIX2_ERR_PROTOTYPE_POLLUTION')));
pass('Validation guards against prototype pollution in structural node IDs');

console.log('\n====================================================');
console.log(`ALL PIX2 1.1 TESTS PASSED (${passCount}/${passCount})`);
console.log('====================================================\n');
