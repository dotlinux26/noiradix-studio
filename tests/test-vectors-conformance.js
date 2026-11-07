const fs = require('fs');
const path = require('path');
const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');

console.log('====================================================');
console.log('RUNNING PIX2 NORMATIVE TEST VECTOR CONFORMANCE SUITE');
console.log('====================================================\n');

const vectorsDir = path.join(__dirname, '..', 'pix2', 'test-vectors');

// Test 1: canonical_valid_hero.pix2 roundtrip & AST comparison
const validPix2 = fs.readFileSync(path.join(vectorsDir, 'canonical_valid_hero.pix2'), 'utf8');
const expectedJson = JSON.parse(fs.readFileSync(path.join(vectorsDir, 'canonical_valid_hero.json'), 'utf8'));

const parsedDoc = PIX2.parse(validPix2);
const validation = PIX2.validate(parsedDoc, { strict: true });

assert.strictEqual(validation.valid, true, 'canonical_valid_hero must be valid');
assert.strictEqual(validation.errors.length, 0, 'canonical_valid_hero must have zero errors');
assert.strictEqual(parsedDoc.meta.title, expectedJson.meta.title);
assert.strictEqual(Object.keys(parsedDoc.cells).length, 2);
assert.strictEqual(parsedDoc.animations['idle_down'].frames.length, 2);
console.log('  [PASS] canonical_valid_hero.pix2 parsed and matches baseline AST');

// Test 2: invalid_syntax_coordinate.pix2
const invalidCoordText = fs.readFileSync(path.join(vectorsDir, 'invalid_syntax_coordinate.pix2'), 'utf8');
const docInvalidCoord = PIX2.parse(invalidCoordText);
assert.strictEqual(docInvalidCoord.cells['test_invalid_coord'].pixels['1abc,3'], undefined);
assert.strictEqual(docInvalidCoord.cells['test_invalid_coord'].pixels['1,3'], undefined);
console.log('  [PASS] invalid_syntax_coordinate.pix2 correctly rejected malformed coordinate');

// Test 3: invalid_missing_frame.pix2
const missingFrameText = fs.readFileSync(path.join(vectorsDir, 'invalid_missing_frame.pix2'), 'utf8');
const docMissingFrame = PIX2.parse(missingFrameText);
const missingFrameWarn = PIX2.validate(docMissingFrame);
assert.ok(missingFrameWarn.warnings.some(w => w.includes('phantom_cell_404')));
const missingFrameStrict = PIX2.validate(docMissingFrame, { strict: true });
assert.strictEqual(missingFrameStrict.valid, false);
assert.ok(missingFrameStrict.errors.some(e => e.includes('phantom_cell_404')));
console.log('  [PASS] invalid_missing_frame.pix2 correctly flagged missing frame phantom_cell_404');

// Test 4: invalid_out_of_bounds.pix2
const oobText = fs.readFileSync(path.join(vectorsDir, 'invalid_out_of_bounds.pix2'), 'utf8');
const docOob = PIX2.parse(oobText);
const oobWarn = PIX2.validate(docOob);
assert.ok(oobWarn.warnings.some(w => w.includes('outside bounds')));
const oobStrict = PIX2.validate(docOob, { strict: true });
assert.strictEqual(oobStrict.valid, false);
assert.ok(oobStrict.errors.some(e => e.includes('outside bounds')));
console.log('  [PASS] invalid_out_of_bounds.pix2 correctly flagged out-of-bounds coordinates');

console.log('\n====================================================');
console.log('ALL TEST VECTORS VALIDATED SUCCESSFULLY');
console.log('====================================================');
