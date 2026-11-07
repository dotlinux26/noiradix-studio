const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('RUNNING PIX2 TEXTMATE GRAMMAR VALIDATION SUITE');
console.log('====================================================\n');

const grammarPath = path.join(__dirname, '..', 'syntaxes', 'pix2.tmLanguage.json');
const raw = fs.readFileSync(grammarPath, 'utf8');

// Test 1: Verify JSON is strictly valid
let grammar;
try {
  grammar = JSON.parse(raw);
  console.log('  [PASS] syntaxes/pix2.tmLanguage.json is strictly valid JSON');
} catch (e) {
  console.error('  [FAIL] Invalid JSON:', e.message);
  process.exit(1);
}

// Test 2: Verify all regex patterns compile cleanly
function checkPatterns(repo) {
  for (const [key, section] of Object.entries(repo)) {
    if (section.match) new RegExp(section.match);
    if (section.patterns) {
      for (const p of section.patterns) {
        if (p.match) new RegExp(p.match);
        if (p.begin) new RegExp(p.begin);
        if (p.end) new RegExp(p.end);
      }
    }
  }
}

try {
  checkPatterns(grammar.repository);
  console.log('  [PASS] All RegExp patterns in tmLanguage compile cleanly');
} catch (e) {
  console.error('  [FAIL] Invalid RegExp pattern:', e.message);
  process.exit(1);
}

// Test 3: Functional Tokenization & Scope Assertions
const repo = grammar.repository;

// 3.1. Comment vs Hex Disambiguation
const commentHashPattern = new RegExp(repo.comments.patterns.find(p => p.name === 'comment.line.number-sign.pix2').match);
const hexColorPattern = new RegExp(repo.colors.match);

// Pure hex should NOT trigger comment pattern
assert.strictEqual(commentHashPattern.test('#ffffff'), false, 'Hex code #ffffff must not be matched as comment');
assert.strictEqual(commentHashPattern.test('#57546f'), false, 'Hex code #57546f must not be matched as comment');
assert.strictEqual(commentHashPattern.test('#12345678'), false, '8-digit hex #12345678 must not be matched as comment');

// Comments with leading whitespace MUST trigger comment pattern
assert.strictEqual(commentHashPattern.test('# this is a comment'), true, 'Leading # comment must match');
assert.strictEqual(commentHashPattern.test(' # trailing comment'), true, 'Whitespace-separated # comment must match');

// Hex colors must strictly match 3, 4, 6, 8 hex digits and reject 5 or 7
assert.strictEqual(hexColorPattern.test('#fff'), true, '3-digit hex #fff must match');
assert.strictEqual(hexColorPattern.test('#fffa'), true, '4-digit hex #fffa must match');
assert.strictEqual(hexColorPattern.test('#ffffff'), true, '6-digit hex #ffffff must match');
assert.strictEqual(hexColorPattern.test('#ffffffff'), true, '8-digit hex #ffffffff must match');
assert.strictEqual(hexColorPattern.test('#12345'), false, 'Invalid 5-digit hex #12345 must not match');
assert.strictEqual(hexColorPattern.test('#1234567'), false, 'Invalid 7-digit hex #1234567 must not match');
console.log('  [PASS] Comment vs Hex color disambiguation and alternation length rules verified');

// 3.2. Directives & Section Identifier Captures
const directivePattern = new RegExp(repo.directives.patterns[0].match);

const cellMatch = '@cell cell_0_0'.match(directivePattern);
assert.ok(cellMatch, '@cell directive must match');
assert.strictEqual(cellMatch[1], '@cell', 'Group 1 must capture @cell');
assert.strictEqual(cellMatch[4], 'cell_0_0', 'Group 4 must capture section identifier "cell_0_0"');

const animMatch = '@animation walk_down'.match(directivePattern);
assert.ok(animMatch, '@animation directive must match');
assert.strictEqual(animMatch[1], '@animation', 'Group 1 must capture @animation');
assert.strictEqual(animMatch[4], 'walk_down', 'Group 4 must capture section identifier "walk_down"');

const pix2Match = '@pix2 1.0'.match(directivePattern);
assert.ok(pix2Match, '@pix2 directive must match');
assert.strictEqual(pix2Match[1], '@pix2', 'Group 1 must capture @pix2');
assert.strictEqual(pix2Match[4], '1.0', 'Group 4 must capture version "1.0"');

const endMatch = '@end'.match(directivePattern);
assert.ok(endMatch, '@end directive must match');
assert.strictEqual(endMatch[1], '@end');
console.log('  [PASS] Directives and Section Identifier capture groups verified');

// 3.3. Negative Coordinates
const coordPattern = new RegExp(repo.numbers.patterns.find(p => p.name === 'constant.numeric.coordinate.pix2').match);
const sampleLine = 'pixel -5,-10 1';
const matchCoord = sampleLine.match(coordPattern);
assert.ok(matchCoord, 'Negative coordinate must match');
assert.strictEqual(matchCoord[0], '-5,-10', 'Negative coordinate must retain leading minus sign intact');
console.log('  [PASS] Negative coordinate parsing maintains sign integrity');

// 3.4. Palette & Property Keys
const propPattern = new RegExp(repo.properties.patterns[0].match);
const customKeyPattern = new RegExp(repo.properties.patterns[1].match);

assert.ok('title: "Wizard"'.match(propPattern), 'Standard property "title:" must match');
assert.ok('cell_size: 16x16'.match(propPattern), 'Standard property "cell_size:" must match');
assert.ok('shadow: #111111'.match(customKeyPattern), 'Custom palette key "shadow:" must match fallback pattern');
console.log('  [PASS] Standard properties and custom palette keys tokenized cleanly');

console.log('\n====================================================');
console.log('ALL TEXTMATE GRAMMAR TESTS PASSED');
console.log('====================================================');
