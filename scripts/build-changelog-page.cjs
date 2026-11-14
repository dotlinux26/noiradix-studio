const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const releasesDir = path.join(root, 'docs', 'releases');
const outputPath = path.join(root, 'changelog.html');
const checkOnly = process.argv.includes('--check');

function versionParts(fileName) {
  const match = fileName.match(/^v(\d+)\.(\d+)\.(\d+)(?:-(.+))?\.md$/i);
  if (!match) return null;
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] || '',
  };
}

function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return right.core[index] - left.core[index];
  }
  if (!left.prerelease && right.prerelease) return -1;
  if (left.prerelease && !right.prerelease) return 1;
  return right.prerelease.localeCompare(left.prerelease, undefined, { numeric: true });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const releases = fs.readdirSync(releasesDir)
  .filter((name) => versionParts(name))
  .sort(compareVersions)
  .map((name, index) => {
    const version = name.slice(0, -3);
    const content = fs.readFileSync(path.join(releasesDir, name), 'utf8').replace(/^\uFEFF/, '').trimEnd();
    if (!content.startsWith('# ')) throw new Error(`${name} must begin with a Markdown H1 release title.`);
    const isLatest = index === 0;
    return `<details class="release-entry"${isLatest ? ' open' : ''}>
  <summary><span class="release-version">${escapeHtml(version)}</span><span class="release-source">docs/releases/${escapeHtml(name)}</span></summary>
  <pre>${escapeHtml(content)}</pre>
  <a class="source-link" href="https://github.com/dotlinux26/noiradix-studio/blob/main/docs/releases/${encodeURIComponent(name)}" target="_blank" rel="noopener noreferrer">Open this release note on GitHub ↗</a>
</details>`;
  });

if (releases.length === 0) throw new Error(`No versioned release notes found in ${releasesDir}`);

const generated = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f8fafc">
  <meta name="description" content="NOIRADIX Studio and PixelArt release history, generated from the repository's versioned release notes.">
  <link rel="canonical" href="https://noiradix.me/changelog.html">
  <link rel="icon" type="image/svg+xml" href="noiradix-studio-logo.svg">
  <link rel="stylesheet" href="css/changelog.css">
  <title>NOIRADIX // CHANGELOG</title>
</head>
<body>
  <main class="terminal-shell">
    <header class="terminal-header">
      <a class="brand" href="./" aria-label="Back to NOIRADIX Studio">
        <img src="noiradix-studio-logo.svg" width="36" height="36" alt="">
        <span>NOIRADIX<span class="brand-slash">//</span>LOG</span>
      </a>
      <nav class="top-actions" aria-label="Project links">
        <a href="./">← EDITOR</a>
        <a href="https://discord.gg/SJwsdGWubF" target="_blank" rel="noopener noreferrer">DISCORD ↗</a>
      </nav>
    </header>

    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">SYSTEM ARCHIVE · RELEASE NOTES</p>
      <h1 id="page-title">CHANGELOG<span class="cursor" aria-hidden="true">_</span></h1>
      <p class="intro-copy">Release history for NOIRADIX Studio and PixelArt.</p>
    </section>

    <section class="release-list" aria-label="Release history">
      ${releases.join('\n      ')}
    </section>

    <section class="feedback-panel" aria-labelledby="feedback-title">
      <div>
        <p class="eyebrow">COMMUNITY CHANNEL</p>
        <h2 id="feedback-title">Found a bug or have an idea?</h2>
        <p>Send reproducible reports through the repository templates, or talk with the community on Discord.</p>
      </div>
      <div class="feedback-actions">
        <a class="action action-primary" href="https://github.com/dotlinux26/noiradix-studio/issues/new?template=bug_report.yml" target="_blank" rel="noopener noreferrer">REPORT A BUG ↗</a>
        <a class="action" href="https://github.com/dotlinux26/noiradix-studio/issues/new?template=feature_request.yml" target="_blank" rel="noopener noreferrer">SUGGEST A FEATURE ↗</a>
        <a class="action action-discord" href="https://discord.gg/SJwsdGWubF" target="_blank" rel="noopener noreferrer">JOIN DISCORD ↗</a>
      </div>
    </section>

    <footer class="terminal-footer"><span>NOIRADIX / RELEASE ARCHIVE</span><a href="./">RETURN TO WORKSPACE ↑</a><span>END OF INDEX</span></footer>
  </main>
</body>
</html>
`;

if (checkOnly) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== generated) {
    console.error('changelog.html is stale. Run: node scripts/build-changelog-page.cjs');
    process.exitCode = 1;
  } else {
    console.log(`PASS changelog page matches ${releases.length} versioned release notes`);
  }
} else {
  fs.writeFileSync(outputPath, generated, 'utf8');
  console.log(`Generated changelog.html from ${releases.length} versioned release notes`);
}
