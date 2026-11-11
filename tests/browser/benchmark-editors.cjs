// Diagnostic measurements through normal editor entry points; timings are not CI thresholds.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const PIX2 = require('../../js/pix2-format.js');
(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    console.log('Browser', browser.version(), 'viewport 1440x950 DPR 2; sparse density 1/16');
    for (const pa of [false, true]) for (const size of (pa ? [16, 64, 512, 1024] : [16, 64, 512])) {
      const doc = PIX2.createDocument('Profile ' + size, 1, 1, size, size, { profile: pa ? 'pixelart' : 'studio' });
      assert.equal(doc.meta.cellSize.w, size);
      for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) doc.cells.cell_0_0.pixels[`${x},${y}`] = '#4f46e5';
      const content = PIX2.serialize(doc);
      const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.addInitScript(({ pa, content }) => {
        localStorage.setItem('noiradix_about_seen', 'true');
        if (!pa) localStorage.setItem('noiradix_open_project_sessions', JSON.stringify({
          activeId: 'profile', sessions: [{ id: 'profile', title: 'Profile', content,
            activeTabId: 'cell_0_0', openCellTabs: ['cell_0_0'] }]
        }));
      }, { pa, content });
      await page.goto('http://127.0.0.1:8769' + (pa ? '/pixelart/' : '/'));
      const about = page.locator('#btn-about-close-done, #btn-pa-about-close-done').filter({ visible: true });
      if (await about.count()) await about.first().click();
      if (pa) await page.locator('#pa-hidden-file-input').setInputFiles({ name: 'profile.pix2', mimeType: 'text/plain', buffer: Buffer.from(content) });
      await page.waitForFunction(({ pa, size }) => pa
        ? document.querySelector('#pa-dim-badge')?.textContent.startsWith(size + '×')
        : state.doc?.meta.cellSize.w === size, { pa, size });
      await page.locator(pa ? '#pa-canvas-main' : '#cell-overlay').waitFor({ state: 'visible' });
      await page.locator(pa ? '#btn-zoom-fit' : '#btn-cell-zoom-fit').click();
      const measurements = await page.evaluate(async pa => {
        const viewport = document.querySelector(pa ? '#pa-canvas-viewport' : '#canvas-viewport');
        const durations = [];
        for (let i = 0; i < 24; i++) {
          const box = viewport.getBoundingClientRect();
          const start = performance.now();
          viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: i < 12 ? -100 : 100,
            clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true }));
          durations.push(performance.now() - start);
          await new Promise(requestAnimationFrame);
        }
        durations.sort((a, b) => a - b);
        const canvas = document.querySelector(pa ? '#pa-canvas-main' : '#cell-canvas');
        return { median: durations[12], p95: durations[22], max: durations.at(-1),
          heapBytes: performance.memory?.usedJSHeapSize ?? null,
          connectedCanvasBytes: [...document.querySelectorAll('canvas')].reduce((n, c) => n + c.width * c.height * 4, 0),
          backingWidth: canvas.width, backingHeight: canvas.height };
      }, pa);
      assert.deepEqual(errors, []);
      assert.ok(measurements.backingWidth <= 4096 && measurements.backingHeight <= 4096);
      console.log(JSON.stringify({ app: pa ? 'PixelArt' : 'Studio', size, ...measurements }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
