const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const PIX2 = require('../../js/pix2-format.js');

(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      localStorage.setItem('noiradix_about_seen', 'true');
      const record = window.fixtureFile = { content: `@pix2 1.1
@meta
 title: "Grid"
 version: "1.1"
@grid
 columns: 2
 rows: 1
 default_cell: 16x16
@palette
 1: #ff0000
 2: #0000ff
@cell cell_0_0
 grid_pos: 0,0
@layer top
 cell: cell_0_0
@region red
 cell: cell_0_0
 parent: top
 pixel 1,1 1
@cell cell_0_1
 grid_pos: 0,1
@layer second
 cell: cell_0_1
@region blue
 cell: cell_0_1
 parent: second
 pixel 3,3 2
@end` };
      record.content = localStorage.getItem('grid_roundtrip_fixture') || record.content;
      record.handle = {
        kind: 'file', name: 'grid.pix2',
        async queryPermission() { return 'granted'; },
        async requestPermission() { return 'granted'; },
        async getFile() { return new File([record.content], 'grid.pix2', { lastModified: 10 }); },
        async createWritable() { let text; return { async write(value) { text = value; }, async close() { record.content = text; localStorage.setItem('grid_roundtrip_fixture', text); record.saved = true; } }; }
      };
      window.showOpenFilePicker = async () => [record.handle];
    });
    await page.goto(process.env.EDITOR_QA_URL || 'http://127.0.0.1:8769');
    const notice = page.locator('.noira-maintenance-banner');
    if (await notice.isVisible()) await notice.getByRole('button', { name: 'Got it' }).click();
    await page.locator('#btn-open-file').click();
    await page.waitForFunction(() => state.doc?.meta.title === 'Grid');
    const canvas = page.locator('#grid-canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 200, box.y + 64);
    await page.keyboard.press('Control+c');
    await page.mouse.click(box.x + 292, box.y + 64);
    await page.keyboard.press('Control+v');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_1.pixels['1,1']), '#ff0000');
    await page.mouse.click(box.x + 292, box.y + 64, { button: 'right' });
    await page.locator('#grid-context-menu [data-grid-action="flip-h"]').click();
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_1.pixels['14,1']), '#ff0000');
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_1.pixels['1,1']), '#ff0000');
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => window.fixtureFile.saved === true);
    const saved = PIX2.parseValidated(await page.evaluate(() => window.fixtureFile.content));
    assert.equal(saved.cells.cell_0_1.pixels['1,1'], '#ff0000');
    assert.notEqual(saved.cells.cell_0_0.layers[0].id, saved.cells.cell_0_1.layers[0].id);
    await page.reload();
    await page.locator('#btn-open-file').click();
    await page.waitForFunction(() => state.doc?.meta.title === 'Grid' && state.doc.cells.cell_0_1?.pixels['1,1'] === '#ff0000');
    const nameBefore = await page.evaluate(() => state.doc.cells.cell_0_0.name);
    await page.locator('#grid-cell-name').fill('Renamed frame');
    await page.locator('#grid-cell-name').blur();
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_0.name), 'Renamed frame');
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_0.name), nameBefore);
    const directionBefore = await page.evaluate(() => state.doc.cells.cell_0_0.direction || 'none');
    await page.locator('#grid-cell-dir').selectOption('up');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_0.direction), 'up');
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_0.direction || 'none'), directionBefore);
    const restoredCanvas = await canvas.boundingBox();
    await page.mouse.click(restoredCanvas.x + 200, restoredCanvas.y + 64);
    await page.keyboard.press('Delete');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_0.pixels['1,1']), undefined);
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.doc.cells.cell_0_0.pixels['1,1']), '#ff0000');
    await page.mouse.click(restoredCanvas.x + 200, restoredCanvas.y + 64, { button: 'right' });
    await page.locator('#grid-context-menu [data-grid-action="duplicate-row"]').click();
    const duplicated = PIX2.parseValidated(await page.evaluate(() => PIX2.serialize(state.doc)));
    const duplicateCell = Object.values(duplicated.cells).find(cell => cell.row === 1 && cell.col === 0);
    assert.equal(duplicateCell.pixels['1,1'], '#ff0000');
    assert.notEqual(duplicateCell.layers[0].id, duplicated.cells.cell_0_0.layers[0].id);
    await page.locator('#btn-grid-open-editor').click();
    await page.locator('[data-tool="free-select"]').click();
    const art = await page.locator('#cell-overlay').boundingBox();
    const zoom = await page.evaluate(() => state.cellZoom);
    await page.keyboard.down('Control');
    await page.mouse.click(art.x + 1.5 * zoom, art.y + 1.5 * zoom);
    assert.equal(await page.evaluate(() => state.selection), null, 'Ctrl keeps the painted selection pending');
    await page.mouse.click(art.x + 4.5 * zoom, art.y + 4.5 * zoom);
    await page.keyboard.up('Control');
    assert.deepEqual(await page.evaluate(() => [...state.selection.mask]), ['1,1']);
    await page.keyboard.press('Delete');
    assert.equal(await page.evaluate(() => state.getActiveCell().pixels['1,1']), undefined);
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.getActiveCell().pixels['1,1']), '#ff0000');
    await page.evaluate(() => {
      const cell = state.getActiveCell();
      cell.layers[0].children.push({ type: 'region', id: 'multi_qa', cell: cell.id, parent: cell.layers[0].id,
        visible: true, locked: false, pixels: { '4,4': '#0000ff' } });
      state.syncCellComposite(cell.id);
      state.saveSnapshot('Multi-layer test fixture');
    });
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    assert.equal(await page.evaluate(() => Object.keys(state.getActiveCell().pixels).length), 0);
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.getActiveCell().pixels['4,4']), '#0000ff');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+x');
    assert.equal(await page.evaluate(() => Object.keys(state.getActiveCell().pixels).length), 0);
    await page.keyboard.press('Control+v');
    assert.equal(await page.evaluate(() => state.getActiveCell().pixels['4,4']), '#0000ff');
    await page.keyboard.press('Control+a');
    const beforeMove = await page.evaluate(() => state.getActiveCell().layers[0].children.map(node => ({ id: node.id, pixels: { ...node.pixels } })));
    await page.mouse.move(art.x + 8 * zoom, art.y + 8 * zoom);
    await page.mouse.down();
    await page.mouse.move(art.x + 10 * zoom, art.y + 9 * zoom);
    await page.mouse.up();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => state.getActiveCell().pixels['6,5']), '#0000ff');
    assert.equal(await page.evaluate(() => state.getActiveCell().layers[0].children.find(node => node.id === 'multi_qa').pixels['6,5']), '#0000ff');
    assert.deepEqual(await page.evaluate(() => state.getActiveCell().layers[0].children.map(node => node.id)), beforeMove.map(node => node.id));
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.getActiveCell().layers[0].children.find(node => node.id === 'multi_qa').pixels['4,4']), '#0000ff');
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    const beforeTurns = await page.evaluate(() => state.getActiveCell().layers);
    for (let turn = 0; turn < 4; turn++) await page.locator('#btn-rotate-90').click();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => state.getActiveCell().layers), beforeTurns,
      'Studio quarter turns preserve each source region');
    await page.locator('#btn-flip-h').click();
    await page.locator('#btn-flip-h').click();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => state.getActiveCell().layers), beforeTurns,
      'Studio flips preserve each source region');
    await page.evaluate(() => { state.selection = { x: 0, y: 0, w: 8, h: 8 }; });
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.mouse.move(art.x + 8 * zoom, art.y + 8 * zoom);
    await page.mouse.down();
    await page.mouse.move(art.x + 12 * zoom, art.y + 12 * zoom, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => state.selection.w), 12, 'scale handle resizes the selection');
    const scaled = await page.evaluate(() => ({ selection: state.selection,
      pixels: state.getActiveCell().layers[0].children.find(node => node.id === 'multi_qa').pixels }));
    const transform = require('../../js/selection-transform.js');
    assert.deepEqual(scaled.pixels, transform.scalePixelsNearestNeighbor({ '4,4': '#0000ff' }, 8, 8, scaled.selection.w, scaled.selection.h),
      'scale writes the second region into its original source');
    const beforeCancel = await page.evaluate(() => state.getActiveCell().layers);
    await page.keyboard.press('Control+a');
    await page.mouse.move(art.x + 8 * zoom, art.y + 8 * zoom);
    await page.mouse.down();
    await page.mouse.move(art.x + 9 * zoom, art.y + 9 * zoom);
    await page.mouse.up();
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => state.getActiveCell().layers), beforeCancel,
      'Escape restores all original region maps');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    const destination = await page.evaluate(() => {
      const id = Object.keys(state.doc.cells).find(id => id !== state.activeCellId);
      const count = state.doc.cells[id].layers.length;
      state.openCellTab(id);
      return { id, count };
    });
    await page.locator('[data-tab-id="tab-grid-overview"]').click();
    await page.locator(`[data-tab-id="${destination.id}"]`).click();
    await page.keyboard.press('Control+v');
    assert.equal(await page.evaluate(() => state.getActiveCell().layers.length), destination.count + beforeTurns.length,
      'paste into another frame appends a distinct source hierarchy');
    const pastedDocument = PIX2.parseValidated(await page.evaluate(() => PIX2.serialize(state.doc)));
    assert.ok(pastedDocument.cells[destination.id].layers.length > destination.count,
      'cross-frame paste has globally valid IDs and ownership links');
    const beforeFlatten = await page.evaluate(() => Object.fromEntries(Object.entries(state.doc.cells).map(([id, cell]) => [id, cell.pixels])));
    await page.getByRole('button', { name: 'Convert document to PIX2 1.0', exact: true }).click();
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.0');
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(state.doc.cells).map(([id, cell]) => [id, cell.pixels]))), beforeFlatten);
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.1');
    await page.keyboard.press('Control+y');
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.0');
    await page.locator('#btn-convert-v11-layers').click();
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.1');
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(state.doc.cells).map(([id, cell]) => [id, cell.pixels]))), beforeFlatten);
    await page.evaluate(() => { window.fixtureFile.saved = false; });
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => window.fixtureFile.saved === true);
    await page.reload();
    await page.locator('#btn-open-file').click();
    await page.waitForFunction(() => state.doc?.meta.title === 'Grid');
    assert.equal(await page.evaluate(() => state.doc.meta.version), '1.1');
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(state.doc.cells).map(([id, cell]) => [id, cell.pixels]))), beforeFlatten,
      'conversion and scaling survive saving and reopening the serialized file');
    assert.deepEqual(errors, []);
    console.log('Studio grid copy/paste / Ctrl+S / structural file roundtrip PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
