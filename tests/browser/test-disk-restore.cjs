const { chromium } = require('playwright');
const assert = require('node:assert/strict');

function source(title, color = '#ff0000') {
  return `@pix2 1.1\n@meta\n  title: "${title}"\n@grid\n  cols: 1\n  rows: 1\n  default_cell: 16x16\n@cell cell_0_0\n  p 1,1 ${color}\n@end`;
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    const scenarios = [
      { name: 'same', cached: source('Saved'), disk: source('Saved'), dirty: false, baseline: source('Saved'), mtime: 100, expected: 'Saved' },
      { name: 'clean-stale', cached: source('Old Cache'), disk: source('Disk Version', '#0000ff'), dirty: false, baseline: source('Old Cache'), mtime: 110, expected: 'Disk Version' },
      { name: 'same-name-other-session', cached: source('Separate Project'), disk: source('Saved'), dirty: false, baseline: source('Separate Project'), mtime: 100, expected: 'Separate Project', handleSessionId: 'another-project' },
      { name: 'dirty-external', cached: source('Local Draft', '#00ff00'), disk: source('External Edit', '#0000ff'), dirty: true, baseline: source('Saved'), mtime: 100, expected: 'Local Draft', conflict: true },
    ];

    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.addInitScript(value => {
        localStorage.setItem('noiradix_about_seen', 'true');
        localStorage.setItem('noiradix_open_project_sessions', JSON.stringify({
          activeId: 'restore-session',
          sessions: [{
            id: 'restore-session', title: 'Cached project', fileName: 'restore.pix2', filePath: 'restore.pix2',
            content: value.cached, isDirty: value.dirty,
            lastSavedContent: value.baseline, lastKnownFileModified: value.mtime,
            activeTabId: 'tab-grid-overview', openCellTabs: []
          }]
        }));
        window.__diskText = value.disk;
        window.__diskMtime = value.mtime;
        window.__savedFileHandle = {
          kind: 'file', name: 'restore.pix2',
          async getFile() { return new File([window.__diskText], this.name, { lastModified: window.__diskMtime }); },
          async queryPermission() { return 'granted'; },
          async requestPermission() { return 'granted'; },
          async createWritable() { throw new Error('Unexpected write during restore test'); }
        };
        const nativeGet = IDBObjectStore.prototype.get;
        IDBObjectStore.prototype.get = function (key) {
          const request = nativeGet.call(this, key);
          if (this.transaction.db.name === 'noiradix_studio_db' && key === 'current_file') {
            Object.defineProperty(request, 'result', {
              configurable: true,
              get: () => ({ schema: 1, handle: window.__savedFileHandle, sessionId: value.handleSessionId || 'restore-session' })
            });
          }
          return request;
        };
      }, scenario);

      const entryPoint = process.env.EDITOR_QA_FILE_URL || (process.env.EDITOR_QA_URL || 'http://127.0.0.1:8783') + '/';
      await page.goto(entryPoint);
      await page.waitForFunction(title => window.state.doc?.meta?.title === title, scenario.expected);
      const shouldLink = !scenario.handleSessionId;
      assert.equal(await page.locator('#file-source-text').textContent(), shouldLink ? 'Local File' : 'In-Memory Draft',
        `${scenario.name}: only the handle belonging to this project session should reconnect`);
      assert.equal(await page.locator('#header-dirty-dot').evaluate(el => el.classList.contains('is-dirty')), Boolean(scenario.dirty),
        `${scenario.name}: dirty state should match the reconciled document`);

      if (scenario.name === 'same') {
        assert.ok(!(await page.locator('#btn-save-pix2').getAttribute('class')).includes('needs-disk-save'),
          'Disk-equal workspace must not ask to Save to Disk again');
        await page.waitForFunction(() => document.querySelector('#autosave-status-text')?.textContent.startsWith('Saved to Disk'));
      }
      if (scenario.conflict) {
        const preserved = await page.evaluate(() => PIX2.serialize(window.state.doc));
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(() => document.querySelector('#btn-reload-file')?.classList.contains('pulse-warning'));
        assert.equal(await page.evaluate(() => PIX2.serialize(window.state.doc)), preserved,
          'External same-mtime edit must warn and preserve the unsaved browser draft');
        assert.ok(errors.length === 0, `${scenario.name}: no browser exceptions (${errors.join('; ')})`);
      }
      if (!scenario.conflict) assert.deepEqual(errors, [], `${scenario.name}: no browser exceptions`);
      await page.close();
    }

    // Use a genuine structured-cloneable FileSystemFileHandle from OPFS to
    // validate the IndexedDB path itself, not only a simulated handle object.
    const realHandlePage = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    realHandlePage.setDefaultTimeout(15000);
    await realHandlePage.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    await realHandlePage.goto((process.env.EDITOR_QA_URL || 'http://127.0.0.1:8783') + '/');
    await realHandlePage.locator('.project-tab.active').waitFor();
    await realHandlePage.waitForTimeout(250);
    const diskSource = source('Real Handle Saved');
    const realHandleFileName = `noiradix-recovery-${Date.now()}.pix2`;
    await realHandlePage.evaluate(async ({ diskSource, realHandleFileName }) => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(realHandleFileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(diskSource);
      await writable.close();
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('noiradix_studio_db', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('file_handles');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('file_handles', 'readwrite');
        const store = transaction.objectStore('file_handles');
        const record = { schema: 1, handle, sessionId: 'real-handle-session' };
        store.put(record, 'current_file');
        store.put(record, 'session:real-handle-session');
        transaction.oncomplete = resolve;
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
      });
    }, { diskSource, realHandleFileName });
    const workspaceFixture = {
      activeId: 'real-handle-session',
      sessions: [{
        id: 'real-handle-session', title: 'Real Handle Saved', fileName: realHandleFileName,
        filePath: realHandleFileName, isDirty: false, lastSavedContent: diskSource,
        lastKnownFileModified: 0, activeTabId: 'tab-grid-overview', openCellTabs: [], content: diskSource
      }],
      updatedAt: Date.now() + 60000
    };
    await realHandlePage.addInitScript(workspace => {
      localStorage.setItem('noiradix_open_project_sessions', JSON.stringify(workspace));
    }, workspaceFixture);
    await realHandlePage.reload();
    try {
      await realHandlePage.waitForFunction(title => window.state.doc?.meta?.title === title, 'Real Handle Saved');
    } catch (error) {
      console.error('Real handle restore diagnostic', await realHandlePage.evaluate(async () => ({
        title: window.state.doc?.meta?.title,
        sessions: JSON.parse(localStorage.getItem('noiradix_open_project_sessions') || 'null'),
        diskRecord: await new Promise(resolve => {
          const request = indexedDB.open('noiradix_studio_db', 1);
          request.onsuccess = () => {
            const get = request.result.transaction('file_handles').objectStore('file_handles').get('current_file');
            get.onsuccess = () => resolve({ name: get.result?.handle?.name, sessionId: get.result?.sessionId });
            get.onerror = () => resolve('read error');
          };
          request.onerror = () => resolve('open error');
        })
      })));
      throw error;
    }
    assert.equal(await realHandlePage.locator('#file-source-text').textContent(), 'Local File',
      'real FileSystemFileHandle must survive IndexedDB structured clone and workspace reload');
    assert.ok(!(await realHandlePage.locator('#btn-save-pix2').getAttribute('class')).includes('needs-disk-save'),
      'restored real file handle must not ask the user to save the file again');
    await realHandlePage.waitForFunction(() => document.querySelector('#autosave-status-text')?.textContent.startsWith('Saved to Disk'));
    await realHandlePage.close();

    console.log('Studio PASS disk restore via real IndexedDB file handle, clean/draft reconciliation, same-mtime conflict and wrong-session guard');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
