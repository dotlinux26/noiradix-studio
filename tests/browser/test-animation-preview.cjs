const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const channel = process.env.EDITOR_QA_CHANNEL || (process.env.CI ? undefined : 'chrome');
  let browser;
  if (channel) {
    try { browser = await chromium.launch({ channel, headless: true }); }
    catch (_) { browser = await chromium.launch({ headless: true }); }
  } else browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    await page.addInitScript(() => localStorage.setItem('noiradix_about_seen', 'true'));
    await page.goto((process.env.EDITOR_QA_URL || 'http://127.0.0.1:8769') + '/');

    const banner = page.locator('.noira-maintenance-banner');
    if (await banner.isVisible().catch(() => false)) {
      await banner.getByRole('button', { name: 'Got it' }).click();
    }

    await page.locator('#btn-load-demo').click();
    await page.locator('#btn-load-demo-ghost').click();
    await page.waitForFunction(() => window.animPlayer && window.state?.doc?.cells);

    const fitState = await page.evaluate(() => {
      const wrapper = document.getElementById('anim-canvas-wrapper');
      const canvas = document.getElementById('anim-canvas');
      return {
        scale: animPlayer.scale,
        activeFit: document.querySelector('#anim-zoom-group [data-scale="fit"]')?.classList.contains('active'),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        wrapperWidth: wrapper.clientWidth,
        wrapperHeight: wrapper.clientHeight,
      };
    });
    assert.equal(fitState.scale, 'fit');
    assert.equal(fitState.activeFit, true);
    assert.ok(fitState.canvasWidth <= fitState.wrapperWidth);
    assert.ok(fitState.canvasHeight <= fitState.wrapperHeight);

    const clips = await page.evaluate(() => {
      const downCells = Object.values(state.doc.cells).filter(cell => cell.direction === 'down');
      if (!downCells.length) throw new Error('Demo has no down-tagged frame');
      const frames = [downCells[0].id];
      state.doc.animations.qa_fly_down_second = { name: 'QA Down Second', direction: 'down', frames, fps: 7 };
      state.doc.animations.qa_fly_down_third = { name: 'QA Down Third', direction: 'down', frames, fps: 9 };
      const select = document.getElementById('floating-anim-select');
      for (const [name, anim] of Object.entries(state.doc.animations)) {
        if (!Array.from(select.options).some(option => option.value === name)) {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        }
      }
      return animPlayer.getAnimationsForDirection('down').map(([name]) => name);
    });
    assert.ok(clips.length >= 3, 'Fixture includes multiple clips tagged Down');

    const downButton = page.locator('[data-dir="down"]');
    for (let index = 0; index < clips.length; index++) {
      await downButton.click();
      const selected = await page.evaluate(() => ({
        name: animPlayer.activeAnimationName,
        dropdown: document.getElementById('floating-anim-select').value,
        direction: animPlayer.getActiveAnimationObj()?.direction,
      }));
      const expected = clips[index];
      assert.equal(selected.name, expected, `D-pad press ${index + 1} chooses the next Down clip`);
      assert.equal(selected.dropdown, expected, 'Clip dropdown follows directional playback');
      assert.equal(selected.direction, 'down');
    }

    await page.evaluate(() => {
      const wrapper = document.getElementById('anim-canvas-wrapper');
      wrapper.style.width = '160px';
      wrapper.style.height = '160px';
      state.doc.meta.cellSize = { w: 64, h: 64 };
      animPlayer.render();
    });
    await page.waitForFunction(() => {
      const wrapper = document.getElementById('anim-canvas-wrapper');
      const canvas = document.getElementById('anim-canvas');
      return canvas.width <= wrapper.clientWidth && canvas.height <= wrapper.clientHeight;
    });
    const largeFrame = await page.evaluate(() => ({
      scale: animPlayer.getFitScale(),
      width: document.getElementById('anim-canvas').width,
      height: document.getElementById('anim-canvas').height,
    }));
    assert.equal(largeFrame.scale, 2, '64px frame auto-fits to a crisp integer scale in the resized preview');
    assert.deepEqual(errors, []);
    console.log('Animation preview PASS default Fit, 64px auto-fit, and sequential D-pad clip cycling');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
