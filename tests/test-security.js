/**
 * NOIRADIX Studio - Automated Security & Malicious Payload Test Suite
 * Validates resilience against Prototype Pollution, Denial of Service (DoS),
 * Coordinate Flooding, and Malformed Tokens.
 */

const PIX2 = require('../js/pix2-format.js');
const assert = require('assert');

console.log('====================================================');
console.log('RUNNING PIX2 SECURITY & MALICIOUS PAYLOAD SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passCount = 0;
function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// TEST GROUP 1: Prototype Pollution Defenses
// ---------------------------------------------------------------------------
console.log('Test Group 1: Prototype Pollution Defenses');

test('Rejects @cell __proto__ from polluting Object.prototype', () => {
  const payload = `
@pix2 1.0
@cell __proto__
  name: "malicious"
  pixel 0,0 #ffffff
@end
`;
  const doc = PIX2.parse(payload);
  assert.strictEqual(Object.prototype.polluted, undefined);
  assert.strictEqual(Object.prototype.name, undefined);
  assert.ok(!doc.cells['__proto__'] || doc.cells['__proto__'] === Object.prototype);
});

test('Rejects @animation __proto__ from polluting Object.prototype', () => {
  const payload = `
@pix2 1.0
@animation __proto__
  fps: 60
@end
`;
  const doc = PIX2.parse(payload);
  assert.strictEqual(Object.prototype.fps, undefined);
});

test('Rejects @palette __proto__ from polluting Object.prototype', () => {
  const payload = `
@pix2 1.0
@palette
  __proto__: #ff0000
@end
`;
  const doc = PIX2.parse(payload);
  assert.strictEqual(Object.prototype['#ff0000'], undefined);
});

test('resolveColor is immune to prototype properties (toString, valueOf, constructor)', () => {
  const p1 = `
@pix2 1.0
@cell cell_0_0
  p 0,0 toString
  p 1,0 valueOf
  p 2,0 constructor
@end
`;
  const doc = PIX2.parse(p1);
  const cell = doc.cells['cell_0_0'];
  assert.ok(cell);
  // Prototype property tokens must NEVER be evaluated as functions or converted into fake valid hex strings
  assert.notStrictEqual(cell.pixels['0,0'], Object.prototype.toString);
  assert.notStrictEqual(cell.pixels['1,0'], Object.prototype.valueOf);
  assert.notStrictEqual(typeof cell.pixels['0,0'], 'function');
  assert.notStrictEqual(typeof cell.pixels['1,0'], 'function');
  assert.notStrictEqual(typeof cell.pixels['2,0'], 'function');
  assert.strictEqual(cell.pixels['0,0'], undefined, 'Invalid color token "toString" must be safely rejected');
  assert.strictEqual(cell.pixels['1,0'], undefined, 'Invalid color token "valueOf" must be safely rejected');
  assert.strictEqual(cell.pixels['2,0'], undefined, 'Invalid color token "constructor" must be safely rejected');
  // Serializing must not throw TypeError
  const serialized = PIX2.serialize(doc);
  assert.ok(serialized.includes('@cell cell_0_0'));
});

// ---------------------------------------------------------------------------
// TEST GROUP 2: Denial-of-Service (DoS) & Coordinate Clamping
// ---------------------------------------------------------------------------
console.log('\nTest Group 2: Denial-of-Service (DoS) & Resource Clamping');

test('Clamps astronomical grid dimensions (999999x999999)', () => {
  const payload = `
@pix2 1.0
@grid
  columns: 999999
  rows: 999999
@end
`;
  const doc = PIX2.parse(payload);
  assert.ok(doc.meta.grid.cols <= 128, `Cols clamped to ${doc.meta.grid.cols}`);
  assert.ok(doc.meta.grid.rows <= 256, `Rows clamped to ${doc.meta.grid.rows}`);
});

test('Clamps astronomical cell dimensions (999999x999999)', () => {
  const payload = `
@pix2 1.0
@grid
  default_cell: 999999x999999
@end
`;
  const doc = PIX2.parse(payload);
  assert.ok(doc.meta.cellSize.w <= 512, `Cell width clamped to ${doc.meta.cellSize.w}`);
  assert.ok(doc.meta.cellSize.h <= 512, `Cell height clamped to ${doc.meta.cellSize.h}`);
});

test('Limits massive rect fill from causing memory exhaustion', () => {
  const start = Date.now();
  const payload = `
@pix2 1.0
@grid
  default_cell: 16x16
@cell cell_0_0
  rect 0,0 999999 999999 #ffffff fill
@end
`;
  const doc = PIX2.parse(payload);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1000, `Rect completed in ${elapsed}ms (did not freeze execution)`);
  assert.ok(Object.keys(doc.cells.cell_0_0.pixels).length <= 262144);
});

test('Bresenham line tool caps at max steps to avoid infinite loops', () => {
  let steps = 0;
  PIX2.drawLineBresenham(0, 0, 1000000, 1000000, () => {
    steps++;
  });
  assert.ok(steps <= 4096, `Bresenham capped at ${steps} steps`);
});

test('Flood fill caps at max steps and does not cause stack/heap overflow', () => {
  const cell = { pixels: {} };
  const start = Date.now();
  PIX2.floodFillCell(cell, 0, 0, '#ffffff', { w: 10000, h: 10000 });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1000, `Flood fill safely terminated in ${elapsed}ms`);
});

test('Rejects coordinates outside safety bounds (|coord| > 2048)', () => {
  const payload = `
@pix2 1.0
@cell cell_0_0
  p 999999,999999 #ffffff
  p 10,10 #ff0000
@end
`;
  const doc = PIX2.parse(payload);
  assert.strictEqual(doc.cells.cell_0_0.pixels['999999,999999'], undefined);
  assert.strictEqual(doc.cells.cell_0_0.pixels['10,10'], '#ff0000');
});

// ---------------------------------------------------------------------------
// TEST GROUP 3: Validation API
// ---------------------------------------------------------------------------
console.log('\nTest Group 3: Document Validation API');

test('PIX2.validate identifies valid documents', () => {
  const validDoc = PIX2.createDocument('Test', 4, 4, 16, 16);
  const result = PIX2.validate(validDoc);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('PIX2.validate flags illegal prototype keys', () => {
  const pollutedDoc = JSON.parse(`{
    "meta": {
      "grid": { "cols": 4, "rows": 4 },
      "cellSize": { "w": 16, "h": 16 }
    },
    "cells": {
      "__proto__": { "name": "exploit" }
    }
  }`);
  const result = PIX2.validate(pollutedDoc);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('prototype pollution')));
});

test('PIX2.validate flags out-of-bounds pixel coordinates in strict mode', () => {
  const doc = PIX2.createDocument();
  doc.cells['cell_0_0'].pixels['99,99'] = '#ffffff';
  const resWarn = PIX2.validate(doc);
  assert.ok(resWarn.warnings.some(w => w.includes('outside bounds')));
  const resStrict = PIX2.validate(doc, { strict: true });
  assert.strictEqual(resStrict.valid, false);
  assert.ok(resStrict.errors.some(e => e.includes('outside bounds')));
});

test('PIX2.validate flags non-existent animation frame references', () => {
  const doc = PIX2.createDocument();
  doc.animations['ghost_walk'] = { frames: ['ghost_missing_frame_99'] };
  const resWarn = PIX2.validate(doc);
  assert.ok(resWarn.warnings.some(w => w.includes('references non-existent cell')));
  const resStrict = PIX2.validate(doc, { strict: true });
  assert.strictEqual(resStrict.valid, false);
  assert.ok(resStrict.errors.some(e => e.includes('references non-existent cell')));
});

test('Parser strictly rejects malformed coordinate syntax (e.g. "1abc,3")', () => {
  const doc = PIX2.parse(`
@pix2 1.0
@cell test_c
  pixel 1abc,3 #ffffff
  p 2,4xyz #ffffff
  dot bad,5 #ffffff
  pixel 5,6 #00ff00
@end
`);
  assert.strictEqual(doc.cells['test_c'].pixels['1,3'], undefined);
  assert.strictEqual(doc.cells['test_c'].pixels['1abc,3'], undefined);
  assert.strictEqual(doc.cells['test_c'].pixels['2,4'], undefined);
  assert.strictEqual(doc.cells['test_c'].pixels['5,6'], '#00ff00');
});

test('PIX2.validate flags malformed pixel coordinate keys', () => {
  const doc = PIX2.createDocument();
  doc.cells['cell_0_0'].pixels['1abc,3'] = '#ffffff';
  const res = PIX2.validate(doc, { strict: true });
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('malformed pixel coordinate')));
});

test('Canonical cell_size and legacy cellSize aliases are synchronized in AST', () => {
  const doc = PIX2.createDocument('Test', 4, 4, 32, 32);
  assert.strictEqual(doc.meta.cell_size.w, 32);
  assert.strictEqual(doc.meta.cell_size.h, 32);
  assert.strictEqual(doc.meta.cellSize.w, 32);
  assert.strictEqual(doc.meta.cellSize.h, 32);
});

test('Strict integer validation strictly rejects floats (1.5) and unsafe integers', () => {
  const doc = PIX2.parse(`
@pix2 1.0
@cell test_floats
  pixel 1.5,3 #ffffff
  pixel 4,5.8 #ffffff
  pixel 9007199254740992,2 #ffffff
  pixel 7,8 #ff0000
@end
`);
  assert.strictEqual(doc.cells['test_floats'].pixels['1.5,3'], undefined);
  assert.strictEqual(doc.cells['test_floats'].pixels['1,3'], undefined);
  assert.strictEqual(doc.cells['test_floats'].pixels['4,5.8'], undefined);
  assert.strictEqual(doc.cells['test_floats'].pixels['4,5'], undefined);
  assert.strictEqual(doc.cells['test_floats'].pixels['7,8'], '#ff0000');
});

// ---------------------------------------------------------------------------
// TEST GROUP 4: Client-Side XSS & Sanitization Defense
// ---------------------------------------------------------------------------
console.log('\nTest Group 4: Client-Side XSS & Sanitization Defense');

test('Document parser preserves raw data while keeping DOM/Serializer safe', () => {
  const xssPayload = `
@pix2 1.0
@meta
  title: "<script>alert('xss')</script>"
  author: "<img src=x onerror=alert(1)>"
@cell cell_0_0
  name: "<svg onload=alert(document.domain)>"
  p 0,0 #ff0000
@end
`;
  const doc = PIX2.parse(xssPayload);
  assert.strictEqual(doc.meta.title, "<script>alert('xss')</script>");
  const serialized = PIX2.serialize(doc);
  assert.ok(serialized.includes('@cell cell_0_0'));
});

test('Identifier & key sanitizer eliminates prototype keys and traversal tokens', () => {
  assert.strictEqual(PIX2.isSafeIdentifier('__proto__'), false);
  assert.strictEqual(PIX2.isSafeIdentifier('constructor'), false);
  assert.strictEqual(PIX2.isSafeIdentifier('prototype'), false);
  assert.strictEqual(PIX2.isSafeIdentifier('normal_frame_0'), true);
  const sanitized = PIX2.sanitizeKey('../../traversal', 'fallback');
  assert.strictEqual(sanitized, '____traversal');
  assert.strictEqual(sanitized.includes('..'), false);
});

console.log('\n====================================================');
console.log(`SECURITY TEST RESULTS: ${passCount} / ${totalTests} PASSED`);
console.log('====================================================\n');
