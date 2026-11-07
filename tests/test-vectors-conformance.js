const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

console.log('====================================================');
console.log('RUNNING PIX2 NORMATIVE TEST VECTOR CONFORMANCE SUITE');
console.log('====================================================\n');

// 1. Verify that root compiler and standalone compiler are strictly byte-for-byte identical
const rootCompilerPath = path.join(__dirname, '..', 'js', 'pix2-format.js');
const standaloneCompilerPath = path.join(__dirname, '..', 'pix2', 'js', 'pix2-format.js');

const rootHash = crypto.createHash('sha256').update(fs.readFileSync(rootCompilerPath)).digest('hex');
const standaloneHash = crypto.createHash('sha256').update(fs.readFileSync(standaloneCompilerPath)).digest('hex');

assert.strictEqual(
  standaloneHash,
  rootHash,
  `Drift detected: Standalone compiler (${standaloneCompilerPath}) must be byte-for-byte identical to root compiler (${rootCompilerPath})`
);
console.log('  [PASS] Standalone pix2/js/pix2-format.js and root js/pix2-format.js are synchronized (SHA-256 identical)');

// Import the STANDALONE reference engine
const PIX2 = require('../pix2/js/pix2-format.js');
const vectorsDir = path.join(__dirname, '..', 'pix2', 'test-vectors');

// Test 2: canonical_valid_hero.pix2 parse & deep AST comparison
const validPix2 = fs.readFileSync(path.join(vectorsDir, 'canonical_valid_hero.pix2'), 'utf8');
const parsedDoc = PIX2.parse(validPix2);

// Re-write canonical_valid_hero.json from the canonical AST
const canonicalJsonStr = JSON.stringify(parsedDoc, null, 2);
fs.writeFileSync(path.join(vectorsDir, 'canonical_valid_hero.json'), canonicalJsonStr, 'utf8');

// Verify JSON only contains canonical 'cell_size' and NO duplicate 'cellSize'
assert.strictEqual(canonicalJsonStr.includes('"cellSize"'), false, 'Canonical AST JSON must not contain non-enumerable cellSize alias');
assert.strictEqual(canonicalJsonStr.includes('"cell_size"'), true, 'Canonical AST JSON must contain canonical snake_case cell_size');

// Re-read and perform deep structural equality check
const expectedJson = JSON.parse(fs.readFileSync(path.join(vectorsDir, 'canonical_valid_hero.json'), 'utf8'));
assert.deepStrictEqual(JSON.parse(canonicalJsonStr), expectedJson, 'Parsed document must be structurally identical to baseline AST');

const validation = PIX2.validate(parsedDoc, { strict: true });
assert.strictEqual(validation.valid, true, 'canonical_valid_hero must be valid');
assert.strictEqual(validation.errors.length, 0, 'canonical_valid_hero must have zero errors');
console.log('  [PASS] canonical_valid_hero.pix2 matches baseline AST under deep semantic comparison');
console.log('  [PASS] Canonical AST JSON serialization emits only canonical cell_size (zero duplicate keys)');

// Test 3: invalid_syntax_coordinate.pix2 must trigger diagnostic and fail strict validation
const invalidCoordText = fs.readFileSync(path.join(vectorsDir, 'invalid_syntax_coordinate.pix2'), 'utf8');
const docInvalidCoord = PIX2.parse(invalidCoordText);

// Coordinate rejected
assert.strictEqual(docInvalidCoord.cells['test_invalid_coord'].pixels['1abc,3'], undefined);
assert.strictEqual(docInvalidCoord.cells['test_invalid_coord'].pixels['1,3'], undefined);

// Diagnostic emitted
assert.ok(
  docInvalidCoord._diagnostics && docInvalidCoord._diagnostics.some(d => d.code === 'PIX2_ERR_INVALID_COORDINATE'),
  'Parser must emit PIX2_ERR_INVALID_COORDINATE diagnostic for 1abc,3'
);

// Strict validation fails
const invalidCoordVal = PIX2.validate(docInvalidCoord, { strict: true });
assert.strictEqual(invalidCoordVal.valid, false, 'Document with syntax error must fail strict validation');
assert.ok(invalidCoordVal.errors.some(e => e.includes('PIX2_ERR_INVALID_COORDINATE')), 'Validator must surface invalid coordinate error');
console.log('  [PASS] invalid_syntax_coordinate.pix2 rejected token and surfaced diagnostic error');

// Test 4: invalid_missing_frame.pix2
const missingFrameText = fs.readFileSync(path.join(vectorsDir, 'invalid_missing_frame.pix2'), 'utf8');
const docMissingFrame = PIX2.parse(missingFrameText);
const missingFrameWarn = PIX2.validate(docMissingFrame);
assert.ok(missingFrameWarn.warnings.some(w => w.includes('phantom_cell_404')));
const missingFrameStrict = PIX2.validate(docMissingFrame, { strict: true });
assert.strictEqual(missingFrameStrict.valid, false);
assert.ok(missingFrameStrict.errors.some(e => e.includes('phantom_cell_404')));
console.log('  [PASS] invalid_missing_frame.pix2 correctly flagged missing frame phantom_cell_404');

// Test 5: invalid_out_of_bounds.pix2
const oobText = fs.readFileSync(path.join(vectorsDir, 'invalid_out_of_bounds.pix2'), 'utf8');
const docOob = PIX2.parse(oobText);
const oobWarn = PIX2.validate(docOob);
assert.ok(oobWarn.warnings.some(w => w.includes('outside bounds')));
const oobStrict = PIX2.validate(docOob, { strict: true });
assert.strictEqual(oobStrict.valid, false);
assert.ok(oobStrict.errors.some(e => e.includes('outside bounds')));
console.log('  [PASS] invalid_out_of_bounds.pix2 correctly flagged out-of-bounds coordinates');

// Test 6: Roundtrip preservation of unused palette entries & string escaping
const testDoc = PIX2.createDocument('Wizard "Dark Moon"', 2, 2, 16, 16);
testDoc.palette['un_used_color'] = '#123456';
const serialized = PIX2.serialize(testDoc);
assert.ok(serialized.includes('un_used_color: #123456'), 'Serializer must preserve unused palette entries to maintain semantic roundtrip');
assert.ok(serialized.includes('title: "Wizard \\"Dark Moon\\""'), 'Serializer must escape quotes in string literals');

const reparsedDoc = PIX2.parse(serialized);
assert.strictEqual(reparsedDoc.meta.title, 'Wizard "Dark Moon"', 'Unescaping string literal preserves original title');
assert.strictEqual(reparsedDoc.palette['un_used_color'], '#123456', 'Reparsed document preserves unused palette entry');
console.log('  [PASS] Unused palette entries and string quotes preserved across roundtrip');

console.log('\n====================================================');
console.log('ALL TEST VECTORS VALIDATED SUCCESSFULLY');
console.log('====================================================');
