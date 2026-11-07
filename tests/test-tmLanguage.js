const fs = require('fs');
const path = require('path');
const assert = require('assert');

const grammarPath = path.join(__dirname, '..', 'syntaxes', 'pix2.tmLanguage.json');
const raw = fs.readFileSync(grammarPath, 'utf8');

// 1. Verify JSON is strictly valid
let grammar;
try {
  grammar = JSON.parse(raw);
  console.log('[PASS] syntaxes/pix2.tmLanguage.json is valid JSON');
} catch (e) {
  console.error('[FAIL] Invalid JSON:', e.message);
  process.exit(1);
}

// 2. Verify all regex patterns compile without error
function checkPatterns(repo) {
  for (const [key, section] of Object.entries(repo)) {
    if (section.match) {
      new RegExp(section.match);
    }
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
  console.log('[PASS] All RegExp patterns in tmLanguage compile cleanly');
} catch (e) {
  console.error('[FAIL] Invalid RegExp pattern:', e.message);
  process.exit(1);
}

console.log('All grammar validation tests passed!');
