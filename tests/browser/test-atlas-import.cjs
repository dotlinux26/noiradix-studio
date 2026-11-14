const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    await page.addInitScript(() => localStorage.setItem('noiradix_about_seen', 'true'));
    await page.goto((process.env.EDITOR_QA_URL || 'http://127.0.0.1:8783') + '/');
    await page.evaluate(() => { window.__qaErrors = []; });
    await page.locator('[data-tab-id="tab-import-slice"]').click();

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p6sAAAAASUVORK5CYII=', 'base64');
    const name = '" autofocus onfocus="window.__atlasXss=1';
    const atlas = {
      frames: {
        [name]: { frame: { x: 0, y: 0, w: 1, h: 1 }, sourceSize: { w: 1, h: 1 } },
      },
    };
    await page.locator('#input-import-slice-file').setInputFiles([
      { name: 'fixture.png', mimeType: 'image/png', buffer: png },
      { name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(atlas)) },
    ]);
    try {
      await page.locator('.slice-item-row').waitFor();
    } catch (error) {
      console.error('Atlas import diagnostic', await page.evaluate(() => ({
        active: document.querySelector('[data-tab-id="tab-import-slice"]')?.className,
        method: document.querySelector('#select-slice-method')?.value,
        filename: document.querySelector('#import-slice-file-name')?.textContent,
        dimensions: document.querySelector('#import-slice-img-dims')?.textContent,
        count: document.querySelector('#slice-count-badge')?.textContent,
        list: document.querySelector('#import-slices-list')?.innerText,
        toast: document.querySelector('.toast')?.innerText,
        parser: window.ImportSlice?.parseAtlasJSON({ frames: { test: { frame: { x: 0, y: 0, w: 1, h: 1 }, sourceSize: { w: 1, h: 1 } } } }),
        errors: window.__qaErrors || null,
      })));
      console.error('Atlas import page errors', errors);
      throw error;
    }
    assert.equal(await page.locator('.slice-item-row').count(), 1, 'TexturePacker frame metadata appears in the Studio slice list');
    assert.equal(await page.locator('.slice-name-input').inputValue(), name, 'untrusted frame names remain literal input values');
    assert.equal(await page.evaluate(() => window.__atlasXss || 0), 0, 'atlas name cannot inject executable HTML');
    assert.deepEqual(errors, [], `no browser exceptions (${errors.join('; ')})`);
    await page.close();
    console.log('Studio PASS TexturePacker atlas preview, frame geometry and hostile frame-name handling');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
