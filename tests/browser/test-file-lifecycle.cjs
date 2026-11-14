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
            async requestPermission() { record.permissionRequests = (record.permissionRequests || 0) + 1; return record.denied ? 'denied' : 'granted'; },
            async isSameEntry(other) { return other === record.handle; },
            async getFile() {
              record.readCount = (record.readCount || 0) + 1;
              const snapshot = record.content;
              if (record.blockRead) {
                record.readStarted = true;
                await new Promise(resolve => { record.releaseRead = resolve; });
              }
              return new File([snapshot], this.name, { type: 'text/plain', lastModified: record.modified || 200 });
            },
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
        window.showSaveFilePicker = async () => {
          window.savePickerCalls = (window.savePickerCalls || 0) + 1;
          if (window.cancelPicker) throw new DOMException('Picker cancelled', 'AbortError');
          return window.files[window.saveFileId].handle;
        };
      });
      await page.goto((process.env.EDITOR_QA_URL || 'http://127.0.0.1:8769') + (pa ? '/pixelart/' : '/'));
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
      // A read started in A must not publish its content into B after switching.
      await focus(a);
      await page.evaluate(() => {
        window.files.A.content = window.files.A.content.replace('title: "A"', 'title: "External A"');
        window.files.A.blockRead = true;
        window.dispatchEvent(new Event('focus'));
      });
      await page.waitForFunction(() => window.files.A.readStarted);
      await focus(b);
      await page.evaluate(() => { window.files.A.blockRead = false; window.files.A.releaseRead(); });
      await page.waitForTimeout(150);
      assert.equal(await source(), bText, 'Late watcher A cannot replace B');
      await page.evaluate(text => { window.files.A.content = text; }, aText);
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
      const writesBeforeDenial = await page.evaluate(() => {
        window.files.C.fail = false;
        window.files.C.denied = true;
        return window.files.C.started;
      });
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => window.files.C.permissionRequests > 0);
      assert.equal(await page.evaluate(() => window.files.C.started), writesBeforeDenial);
      assert.equal(await dirty(), 1, 'Permission denial keeps unsaved state');
      const pickerCalls = await page.evaluate(() => {
        window.files.C.denied = false;
        window.cancelPicker = true;
        return window.savePickerCalls || 0;
      });
      await page.keyboard.press('Control+Shift+s');
      await page.waitForFunction(count => window.savePickerCalls > count, pickerCalls);
      assert.equal(await dirty(), 1, 'Cancelling the picker keeps unsaved state');
      assert.equal(await page.evaluate(() => window.files.C.content), newerRevision);
      await page.evaluate(() => { window.cancelPicker = false; });
      const retrySource = await source();
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => window.files.C.writes.length === 2);
      assert.equal(await page.evaluate(() => window.files.C.content), retrySource);
      await page.waitForFunction(() => document.querySelector('.project-tab.active .project-tab-dirty-dot') === null);
      assert.equal(await dirty(), 0, 'Retry succeeds after denied/cancelled saves');
      if (!pa) {
        await page.waitForFunction(() => document.querySelector('#studio-toast')?.textContent.includes('could not remember its file link'));
        assert.match(await page.locator('#studio-toast').textContent(), /Reopen it after a reload/,
          'A successful disk write with failed handle persistence must explain how to restore direct saving');
        const sameTimestampExternal = retrySource.replace(/title: "[^"]+"/, 'title: "External Same Time"');
        await page.evaluate(text => { window.files.C.content = text; }, sameTimestampExternal);
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(() => state.doc.meta.title === 'External Same Time');
        assert.equal(await dirty(), 0, 'Clean Studio session reloads a same-timestamp external edit on focus');
        await page.evaluate(text => { window.files.C.content = text; }, retrySource);
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(() => PIX2.serialize(state.doc) === window.files.C.content);
      }
      const readsBeforeInvalid = await page.evaluate(() => {
        window.files.C.content = '@pix2 1.1\n@cell c\n p nope #fff';
        window.files.C.modified = 300;
        return window.files.C.readCount;
      });
      await page.locator('#btn-reload-file').click();
      await page.waitForFunction(count => window.files.C.readCount > count, readsBeforeInvalid);
      await page.waitForTimeout(150);
      assert.equal(await source(), retrySource, 'Invalid external source cannot replace the current document');
      await page.evaluate(text => { window.files.C.content = text; }, retrySource);
      if (pa) {
        await page.locator('#btn-pa-side-code').click();
        await page.locator('#btn-toggle-code-lock').click();
      } else {
        await page.locator('.studio-tab[data-tab-id="tab-pix2-code"]').click();
        await page.locator('#btn-toggle-edit-code').click();
      }
      const code = page.locator(pa ? '#pa-code-editor' : '#pix2-code-text');
      await code.fill('@pix2 1.1\n@cell c\n p nope #fff');
      await focus(a);
      assert.equal(await page.locator('.project-tab.active').getAttribute('data-tab-id'), b,
        'Invalid pending source blocks a project switch');
      await code.fill(retrySource);
      await focus(a);
      await page.waitForTimeout(350);
      assert.equal(await source(), aText, 'A pending code debounce cannot publish B into A');
      await focus(b);
      assert.equal(await source(), retrySource, 'Valid source is settled in its originating project');
      assert.deepEqual(errors, []);
      console.log((pa ? 'PixelArt' : 'Studio') + ' PASS native adapter / duplicate names / queued writes / late edits / Save As / failed stream');
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
