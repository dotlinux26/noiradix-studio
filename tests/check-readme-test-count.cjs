const fs = require('node:fs');
const path = require('node:path');

const testsDir = __dirname;
const readme = fs.readFileSync(path.join(testsDir, '../README.md'), 'utf8');
const declared = readme.match(/Current test inventory for v2\.2\.0: (\d+) Node regression suites\./);
if (!declared) throw new Error('README must declare the current v2.2.0 Node suite count.');

const actual = fs.readdirSync(testsDir).filter((name) => /^test-.*\.js$/.test(name)).length;
const expected = Number(declared[1]);
if (actual !== expected) {
  throw new Error(`README says ${expected} Node suites, but tests/ contains ${actual} test-*.js suites.`);
}
console.log(`PASS README test inventory: ${actual} Node regression suites`);
