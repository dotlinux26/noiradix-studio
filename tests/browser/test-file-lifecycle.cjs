const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    for (const pa of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.addInitScript(() => {
        localStorage.setItem('noiradix_about_seen', 'true');
        window.files = {};
        window.openFileId = 'A';
        window.saveFileId = 'C';
        for (const [id, color] of [['A', '#ff0000'], ['B', '#0000ff'], ['C', '#00ff00']]) {
          const record = {
            content: '@pix2 1.1\n@meta\n title: "' + id + '"\n@grid\n cols: 1\n rows: 1\n default_cell: 16x16\n@cell cell_0_0\n p 1,1 ' + color + '\n',
            writes: [], started: 0, blocked: false, fail: false, aborted: 0
          };
          record.handle = {
            name: id === 'C' ? 'copy.pix2' : 'same.pix2',
            kind: 'file',
            async queryPermission() { return record.denied ? 'denied' : 'granted'; },
            async requestPermission() { return record.denied ? 'denied' : 'granted'; },
            async isSameEntry(other) { return other === record.handle; },
            async getFile() { return new File([record.content], this.name, { type: 'text/plain', lastModified: 100 }); },
            async createWritable() {
              let pending;
              return {
                async write(text) {
                  record.started++;
                  if (record.blocked) await new Promise(resolve => { record.release = resolve; });
                  if (record.fail) throw new Error('Simulated write failure');
                  pending = text;
                },
                async close() { record.content = pending; record.writes.push(pending); },
                async abort() { record.aborted++; }
              };
            }
          };
          window.files[id] = record;
        }
        window.showOpenFilePicker = async () => [window.files[window.openFileId].handle];
        window.showSaveFilePicker = async () => window.files[window.saveFileId].handle;
      });
      await page.goto('http://127.0.0.1:8769' + (pa ? '/pixelart/' : '/'));
      const about = page.locator('#btn-about-close-done, #btn-pa-about-close-done').filter({ visible: true });
      if (await about.count()) await about.first().click();
      const tabs = page.locator('.project-tab[data-tab-id]');
      await tabs.first().waitFor();
      const initial = await tabs.count();
      const source = () => page.evaluate(pa => pa
        ? document.querySelector('#pa-code-editor').value : PIX2.serialize(state.doc), pa);
      const open = async id => {
        await page.evaluate(id => { window.openFileId = id; }, id);
        await page.locator('#btn-open-file').click();
        await page.waitForFunction(({ pa, id }) => pa
          ? document.querySelector('#pa-code-editor').value.includes('title: "' + id + '"')
          : state.doc.meta.title === id, { pa, id });
        return page.locator('.project-tab.active').getAttribute('data-tab-id');
      };
      const a = await open('A');
      const aText = await source();
      const b = await open('B');
      const bText = await source();
      assert.equal(await tabs.count(), initial + 2, 'Different handles with the same filename open independent tabs');
      const focus = id => page.locator('.project-tab[data-tab-id="' + id + '"]').click();
      const dirty = () => page.locator('.project-tab.active .project-tab-dirty-dot').count();
      await focus(a);
      await page.evaluate(() => { window.files.A.blocked = true; });
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => window.files.A.started === 1);
      await focus(b);
      await page.keyboard.press('Control+s');
      assert.equal(await page.evaluate(() => window.files.B.started), 0, 'Writes are serialized');
      await page.evaluate(() => { window.files.A.blocked = false; window.files.A.release(); });
      await page.waitForFunction(() => window.files.B.writes.length === 1);
      assert.deepEqual(await page.evaluate(() => [window.files.A.content, window.files.B.content]), [aText, bText]);
      assert.equal(await dirty(), 0);

      if (!pa) await page.locator('#btn-grid-open-editor').click();
      await page.locator('[data-tool="pen"]').click();
      const canvas = page.locator(pa ? '#pa-canvas-main' : '#cell-overlay');
      const paint = async fraction => {
        const box = await canvas.boundingBox();
        await page.mouse.click(box.x + box.width * fraction, box.y + box.height * fraction);
      };
      await paint(0.25);
      const savedRevision = await source();
      await page.evaluate(() => { window.files.B.blocked = true; });
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => window.files.B.started === 2);
      await paint(0.5);
      const newerRevision = await source();
      assert.notEqual(newerRevision, savedRevision);
      await page.evaluate(() => { window.files.B.blocked = false; window.files.B.release(); });
      await page.waitForFunction(() => window.files.B.writes.length === 2);
      assert.equal(await page.evaluate(() => window.files.B.content), savedRevision);
      assert.equal(await dirty(), 1, 'Completing an older snapshot keeps later edits dirty');
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => window.files.B.writes.length === 3);
      assert.equal(await page.evaluate(() => window.files.B.content), newerRevision);

      await page.evaluate(() => { window.files.C.blocked = true; });
      await page.keyboard.press('Control+Shift+s');
      await page.waitForFunction(() => window.files.C.started === 1);
      await focus(a);
      await page.evaluate(() => { window.files.C.blocked = false; window.files.C.release(); });
      await page.waitForFunction(() => window.files.C.writes.length === 1);
      assert.equal(await source(), aText);
      await focus(b);
      await page.waitForFunction(() => document.querySelector('.project-tab.active .project-tab-label').textContent === 'copy.pix2');
      assert.equal(await source(), newerRevision);
      await paint(0.75);
      await page.evaluate(() => { window.files.C.fail = true; });
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => window.files.C.aborted === 1);
      assert.equal(await dirty(), 1, 'Failed write retains the unsaved marker');
      assert.equal(await page.evaluate(() => window.files.C.content), newerRevision);
      assert.deepEqual(errors, []);
      console.log((pa ? 'PixelArt' : 'Studio') + ' PASS native adapter / duplicate names / queued writes / late edits / Save As / failed stream');
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
