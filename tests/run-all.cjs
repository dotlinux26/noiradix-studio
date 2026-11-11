/** Discover production syntax and every regression suite without a stale CI list. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const syntax = process.argv.includes('--syntax');
const browser = process.argv.includes('--browser');
function scripts(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? scripts(file) : entry.name.endsWith('.js') ? [file] : [];
  });
}
const directory = browser ? path.join(__dirname, 'browser') : __dirname;
const files = syntax
  ? ['js', 'pixelart/js', 'pix2/js'].flatMap((folder) => scripts(path.join(root, folder)))
  : fs
      .readdirSync(directory)
      .filter((name) => (browser ? /^test-.*\.cjs$/ : /^test-.*\.js$/).test(name))
      .map((name) => path.join(directory, name));
files.sort();
if (!files.length) throw new Error('No verification files discovered');
for (const file of files) {
  const result = spawnSync(process.execPath, syntax ? ['--check', file] : [file], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: browser ? { ...process.env, EDITOR_QA_DENSE: '1', EDITOR_QA_DPR: '2' } : process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  `PASS ${files.length} ${syntax ? 'syntax files' : browser ? 'browser suites' : 'Node suites'}`,
);
