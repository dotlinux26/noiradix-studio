const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const PIX2 = require('../../js/pix2-format.js');
(async () => {
  let browser;
  const channel = process.env.EDITOR_QA_CHANNEL || (process.env.CI ? undefined : 'chrome');
  if (channel) {
    try {
      browser = await chromium.launch({ channel, headless: true });
    } catch (_) {
      browser = await chromium.launch({ headless: true });
    }
  } else {
    browser = await chromium.launch({ headless: true });
  }
  try {
    console.log('Chrome', browser.version());
    let studioTabStyle;
    for (const pa of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 1100, height: 840 },
      });
      page.setDefaultTimeout(25000);
      const errs = [];
      page.on('pageerror', (e) => {
        errs.push(e.stack);
        console.log(e.stack);
      });
      page.on('dialog', (d) => d.accept());
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
        route.abort(),
      );
      await page.goto('http://127.0.0.1:8769' + (pa ? '/pixelart/' : '/'));
      await page.waitForTimeout(550);
      const about = page
        .locator('#btn-about-close-done, #btn-pa-about-close-done')
        .filter({ visible: true });
      if (await about.count()) await about.first().click();
      const tabs = page.locator('.project-tab[data-tab-id]');
      const plus = page.locator(
        pa ? '#pa-btn-project-new-tab' : '#btn-project-new-tab',
      );
      const initial = await tabs.count();
      const firstId = await tabs.first().getAttribute('data-tab-id');
      const versionLabel = await page.evaluate(pa => {
        const app = pa ? NOIRADIX_VERSION.pixelart : NOIRADIX_VERSION.studio;
        return `${app.name} ${app.displayVersion}`;
      }, pa);
      assert.ok((await page.title()).endsWith(versionLabel));
      await plus.click();
      await page
        .locator(pa ? '#btn-confirm-new-canvas' : '#btn-confirm-new-file')
        .click();
      assert.equal(await tabs.count(), initial + 1);
      assert.equal(await tabs.first().getAttribute('data-tab-id'), firstId);
      const added = tabs.last();
      const tabStyle = await added.evaluate(tab => {
        const style = getComputedStyle(tab);
        return [style.height, style.maxWidth, style.padding, style.borderRadius, style.fontSize, style.backgroundColor, style.borderBottomWidth];
      });
      if (pa) assert.deepEqual(tabStyle, studioTabStyle, 'PixelArt and Studio render the same active tab style');
      else studioTabStyle = tabStyle;
      const addedId = await added.getAttribute('data-tab-id');
      await added.press('Alt+ArrowLeft');
      assert.equal(await tabs.nth(initial - 1).getAttribute('data-tab-id'), addedId);
      await tabs.nth(initial - 1).press('Delete');
      assert.equal(await tabs.count(), initial);
      assert.equal(await tabs.first().getAttribute('data-tab-id'), firstId);
      const png = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 16;
        const context = canvas.getContext('2d');
        context.fillStyle = '#f008';
        context.fillRect(2, 2, 8, 8);
        return canvas.toDataURL().split(',')[1];
      });
      const file = {
        name: 'red.png',
        mimeType: 'image/png',
        buffer: Buffer.from(png, 'base64'),
      };
      if (!pa) {
        const primary = page.locator('.studio-tab');
        await page.locator('#btn-grid-open-editor').click();
        assert.equal(await primary.count(), 5);
        assert.deepEqual(
          await primary.evaluateAll((list) =>
            list.slice(0, 4).map((x) => x.dataset.tabId),
          ),
          [
            'tab-grid-overview',
            'tab-anim-studio',
            'tab-import-slice',
            'tab-pix2-code',
          ],
        );
        const before = await page.evaluate(() => PIX2.serialize(state.doc));
        await page
          .locator('.studio-tab[data-tab-id="tab-import-slice"]')
          .click();
        await page.locator('#input-import-slice-file').setInputFiles(file);
        await page.waitForFunction(
          () => document.getElementById('import-slice-canvas').width === 16,
        );
        const rows = page.locator('.slice-item-row');
        const initialSlices = await rows.count();
        await page.locator('#btn-slice-tool-draw').click();
        const sheet = await page.locator('#import-slice-canvas').boundingBox();
        const from = {
          x: sheet.x + (sheet.width * 2.5) / 16,
          y: sheet.y + (sheet.height * 2.5) / 16,
        };
        const to = {
          x: sheet.x + (sheet.width * 4.5) / 16,
          y: sheet.y + (sheet.height * 4.5) / 16,
        };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 5 });
        await page.mouse.up();
        assert.equal(await rows.count(), initialSlices + 1);
        assert.equal(
          await rows.last().locator('.slice-coord-w').inputValue(),
          '3',
        );
        const cropWidth = rows.last().locator('.slice-coord-w');
        await cropWidth.fill('5');
        await cropWidth.press('Tab');
        assert.equal(await cropWidth.inputValue(), '5');
        await rows.last().locator('.btn-del-slice').click();
        assert.equal(await rows.count(), initialSlices);
        const splitter = page.locator('#slice-config-resizer');
        const configWidth = () =>
          splitter.evaluate(
            (element) =>
              element.previousElementSibling.getBoundingClientRect().width,
          );
        const widthBefore = await configWidth();
        const splitterBox = await splitter.boundingBox();
        await page.mouse.move(
          splitterBox.x + splitterBox.width / 2,
          splitterBox.y + splitterBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          splitterBox.x + 40,
          splitterBox.y + splitterBox.height / 2,
          { steps: 5 },
        );
        await page.mouse.up();
        assert.ok((await configWidth()) > widthBefore);
        await page.setViewportSize({ width: 820, height: 840 });
        for (const id of ['slice-viewport-header', 'import-slices-header']) {
          const bar = page.locator('#' + id);
          assert.equal(
            await bar.evaluate((e) => getComputedStyle(e).flexWrap),
            'nowrap',
          );
          assert.ok(await bar.evaluate((e) => e.scrollWidth > e.clientWidth));
          const title = await bar.locator(':scope > div').first().boundingBox();
          await page.mouse.move(title.x + 90, title.y + title.height / 2);
          await page.mouse.down();
          await page.mouse.move(title.x + 30, title.y + title.height / 2, {
            steps: 5,
          });
          await page.mouse.up();
          assert.ok(
            await bar.evaluate((e) => e.scrollLeft > 0),
            id + ' drag-scroll',
          );
          await bar.evaluate((e) => {
            e.scrollLeft = 0;
          });
          await bar.hover();
          await page.mouse.wheel(0, 160);
          await page.waitForFunction(
            (id) => document.getElementById(id).scrollLeft > 0,
            id,
          );
        }
        const name = page.locator('.slice-name-input').first();
        await name.fill('');
        await name.pressSequentially('Diagonal frame');
        await name.press('Tab');
        const tag = page.locator('.slice-tag-input').first();
        await tag.fill('walk_down_right');
        await tag.press('Tab');
        const column = page.locator('.slice-col-input').first();
        await column.fill('2');
        await column.press('Tab');
        await page.locator('#btn-import-slice-commit').click();
        assert.equal(
          await tabs.count(),
          initial + 1,
          await page.locator('#studio-toast').innerText(),
        );
        const imported = await page.evaluate(() => ({
          version: state.doc.meta.version,
          cell: state.doc.cells.cell_4_2,
        }));
        assert.equal(imported.version, '1.1');
        assert.equal(imported.cell.name, 'Diagonal frame');
        assert.equal(imported.cell.pixels['2,2'], '#ff000088');
        await tabs.first().click();
        assert.equal(
          await page.evaluate(() => PIX2.serialize(state.doc)),
          before,
        );
      } else {
        const source = page.locator('#pa-code-editor');
        const original = await source.inputValue();
        await page.locator('#pa-hidden-file-input').setInputFiles(file);
        await page.waitForFunction(() =>
          document.getElementById('pa-code-editor').value.includes('#ff000088'),
        );
        assert.equal(await tabs.count(), initial + 1);
        await tabs.first().click();
        assert.equal(await source.inputValue(), original);
      }
      // Reload immediately after drawing, before either autosave debounce.
      await tabs.last().click();
      if (!pa) await page.locator('#btn-grid-open-editor').click();
      const canvas = page.locator(pa ? '#pa-canvas-main' : '#cell-overlay');
      await page.locator('[data-tool="pen"]').click();
      const sourceText = () => page.evaluate(pa => pa
        ? document.querySelector('#pa-code-editor').value
        : PIX2.serialize(state.doc), pa);
      const beforeStroke = await sourceText();
      const canvasBox = await canvas.boundingBox();
      await page.mouse.click(canvasBox.x + canvasBox.width * 0.18, canvasBox.y + canvasBox.height * 0.18);
      const afterStroke = await sourceText();
      assert.notEqual(afterStroke, beforeStroke);
      const expectedTabs = await tabs.evaluateAll(rows => rows.map(row => row.dataset.tabId));
      const expectedActive = await page.locator('.project-tab.active').getAttribute('data-tab-id');
      await page.reload();
      await page.waitForFunction(id => document.querySelector('.project-tab.active')?.dataset.tabId === id, expectedActive);
      assert.deepEqual(await tabs.evaluateAll(rows => rows.map(row => row.dataset.tabId)), expectedTabs);
      assert.equal(await sourceText(), afterStroke);
      assert.ok((await page.title()).startsWith('● '));
      assert.ok((await page.title()).endsWith(versionLabel));
      // Force the workspace mirror to hit quota and exercise IndexedDB recovery.
      const workspaceKey = pa ? 'noiradix_pixelart_open_sessions' : 'noiradix_open_project_sessions';
      await page.evaluate(key => {
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (item, value) {
          if (this === localStorage && item === key) throw new DOMException('Test quota', 'QuotaExceededError');
          return setItem.call(this, item, value);
        };
      }, workspaceKey);
      const restoredBox = await canvas.boundingBox();
      await page.mouse.click(restoredBox.x + restoredBox.width * 0.8, restoredBox.y + restoredBox.height * 0.75);
      const afterQuotaStroke = await sourceText();
      assert.notEqual(afterQuotaStroke, afterStroke);
      await page.waitForFunction(pa => document.getElementById(
        pa ? 'pa-autosave-status-text' : 'autosave-status-text'
      )?.textContent.startsWith('Browser Draft Saved'), pa);
      const savedInFallback = await page.evaluate(async ({ key, id, pa }) => {
        const data = await EditorWorkspaceStorage.read(key);
        const draft = data?.sessions.find(session => session.id === id);
        return draft?.[pa ? 'documentSource' : 'content'];
      }, { key: workspaceKey, id: expectedActive, pa });
      assert.equal(savedInFallback, afterQuotaStroke);
      await page.reload();
      await page.waitForFunction(id => document.querySelector('.project-tab.active')?.dataset.tabId === id, expectedActive);
      assert.equal(await sourceText(), afterQuotaStroke);
      await page.addInitScript(key => {
        if (sessionStorage.getItem('qa-corrupt-catalog')) return;
        sessionStorage.setItem('qa-corrupt-catalog', 'done');
        localStorage.setItem(key, JSON.stringify({
          updatedAt: 9999999999999, sessions: 'corrupt catalog'
        }));
      }, workspaceKey);
      await page.reload();
      await page.waitForFunction(id => document.querySelector('.project-tab.active')?.dataset.tabId === id, expectedActive);
      assert.equal(await sourceText(), afterQuotaStroke, 'A corrupt local catalog cannot hide the valid IndexedDB backup');
      while (await tabs.count())
        await tabs.last().locator('.project-tab-close').click();
      assert.ok(
        await page
          .locator(pa ? '#pa-empty-workspace' : '#studio-empty-workspace')
          .isVisible(),
      );
      assert.ok(await plus.isVisible());
      await page.reload();
      await page
        .locator(pa ? '#pa-empty-workspace' : '#studio-empty-workspace')
        .waitFor({ state: 'visible' });
      assert.equal(await tabs.count(), 0);
      assert.equal(await page.title(), versionLabel);
      if (!pa) {
        await page.locator('#btn-empty-load-reaper').click();
        await tabs.first().waitFor();
        assert.equal(await tabs.count(), 1);
        const reaper = await sourceText();
        await page.locator('#btn-load-demo').click();
        await page.locator('#btn-load-demo-ghost').click();
        assert.equal(await tabs.count(), 2, 'Demo creates an independent session');
        await tabs.first().click();
        assert.equal(await sourceText(), reaper);
        await tabs.last().click();
        const ghost = await sourceText();
        await page.locator('#btn-grid-open-editor').click();
        const c = await page.locator('#cell-overlay').boundingBox();
        await page.mouse.click(c.x + c.width * 0.18, c.y + c.height * 0.18);
        assert.notEqual(await sourceText(), ghost);
        await page.keyboard.press('Control+z');
        assert.equal(await sourceText(), ghost, 'The first demo edit can be undone');
      }
      assert.deepEqual(errs, []);
      console.log(
        (pa ? 'PixelArt' : 'Studio') +
          ' PASS new/close/empty/immediate reload/quota fallback' +
          (pa
            ? '/PNG import'
            : '/pinned tabs/slice import, resize & toolbar scroll'),
      );
    }
    const legacy = readFileSync(
      join(__dirname, '../fixtures/safe01_v10_multicell_alpha_clip.pix2'),
      'utf8',
    );
    const page = await browser.newPage({
      viewport: { width: 1440, height: 950 },
    });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.addInitScript((content) => {
      localStorage.setItem('noiradix_about_seen', 'true');
      localStorage.setItem(
        'noiradix_open_project_sessions',
        JSON.stringify({
          activeId: 'legacy',
          sessions: [
            {
              id: 'legacy',
              title: 'Legacy fixture',
              content,
              activeTabId: 'idle_custom',
              openCellTabs: ['idle_custom'],
            },
          ],
        }),
      );
    }, legacy);
    await page.goto('http://127.0.0.1:8769/');
    await page.locator('#btn-convert-v11-layers').click();
    const converted = PIX2.parse(
      await page.evaluate(() => PIX2.serialize(state.doc)),
    );
    const original = PIX2.parse(legacy);
    assert.equal(converted.meta.version, '1.1');
    assert.deepEqual(converted.animations, original.animations);
    for (const cellId of Object.keys(original.cells)) {
      assert.deepEqual(
        converted.cells[cellId].pixels,
        original.cells[cellId].pixels,
      );
    }
    const canvas = page.locator('#cell-overlay');
    const box = await canvas.boundingBox();
    await page.mouse.click(
      box.x + (box.width * 7.5) / 8,
      box.y + (box.height * 7.5) / 8,
    );
    assert.ok(
      await page.evaluate(() => state.doc.cells.idle_custom.pixels['7,7']),
    );
    await page.keyboard.press('Control+z');
    assert.equal(
      await page.evaluate(() => state.doc.cells.idle_custom.pixels['7,7']),
      undefined,
    );
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.0');
    await page.keyboard.press('Control+y');
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.1');
    console.log(
      'Studio PASS legacy multi-cell conversion / immediate drawing / undo / redo',
    );
    const gridPage = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
    gridPage.setDefaultTimeout(25000);
    await gridPage.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    const largeSheet = PIX2.serialize(PIX2.createDocument('Large Grid', 4, 4, 512, 512));
    await gridPage.addInitScript(content => {
      localStorage.setItem('noiradix_about_seen', 'true');
      localStorage.setItem('noiradix_open_project_sessions', JSON.stringify({
        activeId: 'large', sessions: [{ id: 'large', title: 'Large Grid', content }]
      }));
    }, largeSheet);
    await gridPage.goto(pathToFileURL(join(__dirname, '../../index.html')).href);
    await gridPage.locator('#btn-grid-zoom-fit').click();
    assert.match(await gridPage.locator('#grid-zoom-level').innerText(), /%$/);
    const gridCanvas = gridPage.locator('#grid-canvas');
    const grid = await gridCanvas.boundingBox();
    const viewport = await gridPage.locator('.grid-canvas-viewport').boundingBox();
    assert.ok(grid.x >= viewport.x && grid.y >= viewport.y);
    assert.ok(grid.x + grid.width <= viewport.x + viewport.width && grid.y + grid.height <= viewport.y + viewport.height);
    await gridPage.locator('#btn-grid-zoom-out').click();
    assert.ok((await gridCanvas.boundingBox()).width < grid.width);
    await gridPage.keyboard.press('Shift+Space');
    assert.ok(Math.abs((await gridCanvas.boundingBox()).width - grid.width) < 1);
    const hit = await gridCanvas.boundingBox();
    const zoom = (hit.width - 192 - 4 * 28 - 36) / (4 * 512);
    const x = hit.x + 192 + 3 * (512 * zoom + 28) + 256 * zoom;
    const y = hit.y + 56 + 3 * (512 * zoom + 52) + 256 * zoom;
    await gridPage.mouse.click(x, y, { clickCount: 2 });
    await gridPage.waitForFunction(() => state.activeTabId === 'cell_3_3');
    assert.ok(await gridCanvas.evaluate(canvas => Math.max(canvas.width, canvas.height) <= 4096));
    console.log('Studio PASS 4×4 grid of 512×512 frames / Fit / sub-1× zoom / double-click at DPR 2');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
