/**
 * ==============================================================================
 * TEST SUITE: PIX2 1.1 AI PROMPT GENERATOR CONFORMANCE
 * ==============================================================================
 * Verifies that Pix2AiPrompt produces comprehensive (600 - 800 line) cognitive
 * prompts explaining the complete PIX2 1.1 specification and NOIRADIX Studio v2.1.0
 * engine rules across all specialization modes.
 * ==============================================================================
 */

const assert = require('assert');
const { Pix2AiPrompt } = require('../js/pix2-ai-prompt.js');

console.log('====================================================');
console.log('RUNNING PIX2 1.1 AI PROMPT CONFORMANCE SUITE');
console.log('====================================================');

const MODES = [
  'all-in-one',
  'full-character',
  'walk-animation',
  'accessory-equipment',
  'surgical-patch',
  'raw-spec'
];

let totalPass = 0;

// Test 1: Verify prompt length invariant (600 - 800 lines) across all modes
console.log('\nTest 1: Prompt Line Count Invariant (600 - 800 lines)');
for (const mode of MODES) {
  const prompt = Pix2AiPrompt.build({
    width: 16,
    height: 16,
    cols: 4,
    rows: 4,
    mode
  });
  const lines = prompt.split('\n');
  const count = lines.length;
  console.log(`  Mode [${mode}]: ${count} lines`);
  assert(count >= 600, `Mode ${mode} prompt line count ${count} must be >= 600`);
  assert(count <= 800, `Mode ${mode} prompt line count ${count} must be <= 800`);
}
console.log('  [PASS] All specialization modes generate prompts within 600 - 800 line target.');
totalPass++;

// Test 2: Master All-in-One Prompt Architectural Completeness
console.log('\nTest 2: Master All-in-One Prompt Architectural Completeness');
const masterPrompt = Pix2AiPrompt.build({
  brief: 'Synthesize custom Wispling mascot with magical aura',
  source: '@pix2 1.1\n@cell cell_0_0\n@end',
  width: 32,
  height: 32,
  cols: 4,
  rows: 2,
  mode: 'all-in-one'
});

const REQUIRED_TOKENS = [
  '@pix2 1.1',
  '@meta',
  '@grid',
  '@palette',
  '@cell',
  '@layer',
  '@group',
  '@region',
  '@animation',
  '@end',
  'Porter-Duff',
  'alpha_effective',
  'opacity_region',
  'https://noiradix.me/',
  'ZERO CROSS-REGION MUTATION',
  'PURE TRANSPARENCY INVARIANT',
  'TOP-LEFT',
  'Platformer 2D Locomotion',
  'idle_right',
  'run_right',
  'walk_down',
  'walk_up',
  'tags:',
  'blend: normal',
  'MANDATORY PRE-FLIGHT AI VERIFICATION CHECKLIST'
];

for (const token of REQUIRED_TOKENS) {
  assert(masterPrompt.includes(token), `Master prompt must include required token: "${token}"`);
}
assert(!masterPrompt.includes('noiradix.org'), 'Must strictly NEVER reference noiradix.org');
console.log('  [PASS] Master prompt contains all 1.1 structural directives, math formulas, and invariants.');
totalPass++;

// Test 3: Structural Region Invariant & Command Isolation
console.log('\nTest 3: Structural Region Invariant & Command Isolation Rules');
assert(
  masterPrompt.includes('MUST be declared inside `@region` blocks') ||
  masterPrompt.includes('MUST live inside `@region` blocks'),
  'Prompt must explicitly enforce that raster commands live in @region blocks'
);
assert(
  masterPrompt.includes('pixel commands directly under `@cell` or `@layer` violates'),
  'Prompt must explicitly forbid loose pixels under @cell or @layer'
);
console.log('  [PASS] Structural region invariant and command isolation strictly enforced.');
totalPass++;

// Test 4: Locomotion Models (4-Direction & Platformer 2D)
console.log('\nTest 4: Locomotion Models (4-Direction & Platformer 2D)');
assert(masterPrompt.includes('4-Direction Standard (Top-Down / RPG)'), 'Must include 4-dir locomotion');
assert(masterPrompt.includes('Platformer 2D Locomotion Standard'), 'Must include platformer 2D locomotion');
assert(masterPrompt.includes('Secondary Motion Physics'), 'Must include secondary motion lag rules');
console.log('  [PASS] 4-direction RPG and Platformer 2D locomotion specifications validated.');
totalPass++;

// Test 5: Resource Profile Limits Inclusion
console.log('\nTest 5: Resource Profile Limits Inclusion');
assert(masterPrompt.includes('max 512×512 cell') || masterPrompt.includes('Max 512×512 cell'), 'Must include max 512x512 cell limit');
assert(masterPrompt.includes('4096 cells max') || masterPrompt.includes('max 4096 cells'), 'Must include 4096 max cells limit');
assert(masterPrompt.includes('maxLayersPerCell') || masterPrompt.includes('64 layers'), 'Must include max layers limit');
console.log('  [PASS] Resource profile limits validated.');
totalPass++;

console.log('\n====================================================');
console.log(`ALL PIX2 1.1 AI PROMPT TESTS PASSED (${totalPass}/${totalPass})`);
console.log('====================================================');
