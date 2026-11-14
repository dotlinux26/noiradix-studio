const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/changelog.html');
    assert.equal(await page.title(), 'NOIRADIX // CHANGELOG');
    assert.equal(await page.locator('.release-entry').count(), 13, 'All versioned release notes are included');
    assert.equal(await page.locator('.release-entry').first().locator('.release-version').textContent(), 'v2.2.1',
      'The latest stable release appears first');
    assert.equal(await page.locator('.release-entry').first().getAttribute('open'), '');
    assert.equal(await page.locator('.release-entry').nth(1).getAttribute('open'), null,
      'Older releases start collapsed to keep the archive scannable');
    const latestText = await page.locator('.release-entry').first().locator('pre').textContent();
    assert.match(latestText, /## Highlights/, 'Release notes are shown as readable raw Markdown text without a parser');
    assert.match(latestText, /floating Animation Studio preview now opens in Fit mode/, 'Generated page contains current release content');

    const bugLink = page.getByRole('link', { name: 'REPORT A BUG ↗' });
    assert.equal(await bugLink.getAttribute('href'),
      'https://github.com/dotlinux26/noiradix-studio/issues/new?template=bug_report.yml');
    assert.equal(await page.getByRole('link', { name: 'SUGGEST A FEATURE ↗' }).getAttribute('href'),
      'https://github.com/dotlinux26/noiradix-studio/issues/new?template=feature_request.yml');
    assert.equal(await page.getByRole('link', { name: 'JOIN DISCORD ↗' }).getAttribute('href'),
      'https://discord.gg/SJwsdGWubF');
    assert.ok(await page.getByRole('link', { name: 'RETURN TO WORKSPACE ↑' }).count());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Desktop changelog has no horizontal page overflow');

    await page.setViewportSize({ width: 360, height: 800 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Mobile changelog has no horizontal page overflow');

    await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/index.html');
    const studioAboutLink = page.locator('#modal-about-studio a.about-changelog-link');
    assert.equal(await studioAboutLink.getAttribute('href'), 'changelog.html');
    assert.equal(await studioAboutLink.getAttribute('target'), '_blank', 'Opening history does not discard current work');

    await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/pixelart/index.html');
    const pixelartAboutLink = page.locator('#modal-about-pa a.pa-about-changelog');
    assert.equal(await pixelartAboutLink.getAttribute('href'), '../changelog.html');
    assert.equal(await pixelartAboutLink.getAttribute('target'), '_blank');

    console.log('PASS static changelog archive / generated release sync / Discord / issue templates / Studio and PixelArt About links');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
