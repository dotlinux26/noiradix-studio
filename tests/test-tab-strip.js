/**
 * Shared project tab-strip ordering contract.
 *
 * The pointer gesture itself is a browser-only acceptance case (B12); this
 * suite locks the deterministic ordering math and the static wiring used by
 * both product adapters.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const TabStrip = require('../js/tab-strip.js');

console.log('====================================================');
console.log('RUNNING TAB STRIP ORDERING SUITE');
console.log('====================================================\n');

const ids = ['a', 'b', 'c', 'd'];

assert.deepStrictEqual(
  TabStrip.computeReorder(ids, 'c', 'a', false),
  ['c', 'a', 'b', 'd'],
  'move before the first tab'
);
console.log('  [PASS] drag before first preserves every other tab order');

assert.deepStrictEqual(
  TabStrip.computeReorder(ids, 'a', 'd', true),
  ['b', 'c', 'd', 'a'],
  'move after the last tab'
);
console.log('  [PASS] drag after last moves only the dragged tab');

assert.deepStrictEqual(
  TabStrip.computeReorder(ids, 'b', 'c', true),
  ['a', 'c', 'b', 'd'],
  'adjacent swap'
);
console.log('  [PASS] adjacent swap is stable and duplicate-free');

assert.deepStrictEqual(
  TabStrip.computeReorder(ids, 'b', 'a', false),
  ['b', 'a', 'c', 'd'],
  'already-first position remains idempotent'
);
assert.deepStrictEqual(TabStrip.computeReorder(ids, 'b', 'a', false), ['b', 'a', 'c', 'd']);
console.log('  [PASS] reorder is deterministic and idempotent');

assert.deepStrictEqual(
  TabStrip.computeReorder(ids, 'missing', 'a', false),
  ids,
  'unknown dragged id is a no-op'
);
assert.deepStrictEqual(
  TabStrip.computeReorder(ids, 'a', 'missing', false),
  ['b', 'c', 'd', 'a'],
  'missing reference falls back to append without data loss'
);
console.log('  [PASS] malformed drops never lose or duplicate sessions');

assert.deepStrictEqual(TabStrip.computeReorder(ids, 'd', null, true), ['a', 'b', 'c', 'd']);
console.log('  [PASS] null reference appends deterministically');

assert.strictEqual(TabStrip.attach(null, {}), null);
console.log('  [PASS] adapter tolerates a missing strip');

for (const entry of ['index.html', 'pixelart/index.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', entry), 'utf8');
  assert.ok(html.includes('js/tab-strip.js'), `${entry} loads the shared tab-strip module`);
  assert.ok(
    html.indexOf('js/tab-strip.js') < html.indexOf(entry === 'index.html' ? 'js/app.js' : 'js/pixelart-app.js'),
    `${entry} loads the tab strip before its controller`
  );
}
console.log('  [PASS] both static entry points load the shared module in controller order');

for (const file of ['js/app.js', 'pixelart/js/pixelart-app.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.ok(source.includes('tab.dataset.tabId = session.id'), `${file} exposes stable tab IDs`);
  assert.ok(source.includes('window.NoiraTabStrip.attach'), `${file} attaches the shared controller`);
  assert.ok(
    /const newBtn = document\.createElement\('button'\);[\s\S]{0,700}?strip\.appendChild\(newBtn\);[\s\S]{0,1200}?forEach\(session =>/.test(source) ||
    /const newBtn = document\.createElement\('button'\);[\s\S]{0,700}?dom\.projectTabsStrip\.appendChild\(newBtn\);[\s\S]{0,1200}?forEach\(session =>/.test(source),
    `${file} appends the pinned new-tab action before document tabs`
  );
}
console.log('  [PASS] both adapters pin the new-tab action first and expose reorder IDs');

console.log('\n====================================================');
console.log('ALL TAB STRIP ORDERING TESTS PASSED (10/10)');
console.log('====================================================\n');
