const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const PIX2 = require('../../js/pix2-format.js');
(async () => {
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let dismissNext = false;
    page.on('dialog', dialog => {
      if (dismissNext) { dismissNext = false; return dialog.dismiss(); }
      return dialog.accept();
    });
    await page.goto((process.env.EDITOR_QA_URL || 'http://127.0.0.1:8769') + '/pixelart/');
    const about = page.locator('#btn-pa-about-close-done');
    if (await about.isVisible()) await about.click();
    const notice = page.locator('.noira-maintenance-banner');
    if (await notice.isVisible()) await notice.getByRole('button', { name: 'Got it' }).click();
    await page.locator('#pa-btn-project-new-tab').click();
    await page.locator('#btn-confirm-new-canvas').click();
    const canvas = await page.locator('#pa-canvas-main').boundingBox();
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.locator('#btn-pa-side-code').click();
    const before = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    const beforePixels = Object.values(before.cells)[0].pixels;
    assert.ok(Object.keys(beforePixels).length > 0, 'fixture contains a drawn pixel');
    await page.locator('[data-tool="free-select"]').click();
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.press('Delete');
    await page.locator('#btn-pa-side-code').click();
    const deleted = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.equal(Object.keys(Object.values(deleted.cells)[0].pixels).length, 0);
    await page.keyboard.press('Control+z');
    await page.locator('#btn-pa-side-layers').click();
    const panel = page.locator('#pa-layers-tree');
    const to10 = panel.getByRole('button', { name: 'Convert document to PIX2 1.0' });
    dismissNext = true;
    await to10.click();
    assert.equal(await to10.count(), 1, 'cancelling the warning leaves the document in PIX2 1.1');
    await to10.click();
    await panel.getByRole('button', { name: 'Convert document to PIX2 1.1' }).waitFor();
    await page.keyboard.press('Control+z');
    await panel.getByRole('button', { name: 'Convert document to PIX2 1.0' }).waitFor();
    await page.keyboard.press('Control+y');
    await panel.getByRole('button', { name: 'Convert document to PIX2 1.1' }).waitFor();
    await page.locator('#btn-pa-side-code').click();
    const after = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.deepEqual(Object.values(after.cells)[0].pixels, beforePixels);
    await page.locator('#btn-pa-side-layers').click();
    await panel.getByRole('button', { name: 'Convert document to PIX2 1.1' }).click();
    await panel.getByRole('button', { name: 'Convert document to PIX2 1.0' }).waitFor();
    await page.locator('#btn-pa-side-code').click();
    const upgraded = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.equal(upgraded.meta.version, '1.1');
    assert.deepEqual(Object.values(upgraded.cells)[0].pixels, beforePixels);
    const artwork = Object.values(upgraded.cells)[0];
    artwork.layers.push({ type: 'layer', id: 'qa_second_layer', cell: artwork.id, visible: true, locked: false, opacity: 1,
      children: [{ type: 'region', id: 'qa_second_region', cell: artwork.id, parent: 'qa_second_layer', visible: true, locked: false, pixels: { '1,1': '#0000ff' } }] });
    await page.locator('#btn-toggle-code-lock').click();
    await page.locator('#pa-code-editor').fill(PIX2.serialize(upgraded));
    await page.locator('#btn-apply-code').click();
    await page.locator('#btn-view-split').click();
    beforePixels['1,1'] = '#0000ff';
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.locator('#btn-pa-side-code').click();
    const clearedAll = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.equal(Object.keys(Object.values(clearedAll.cells)[0].pixels).length, 0);
    await page.keyboard.press('Control+z');
    const restoredAll = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.deepEqual(Object.values(restoredAll.cells)[0].pixels, beforePixels);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+x');
    await page.keyboard.press('Control+v');
    const pastedAll = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.deepEqual(Object.values(pastedAll.cells)[0].pixels, beforePixels);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+v');
    const pastedAfterHistory = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.equal(Object.values(pastedAfterHistory.cells)[0].layers.length, artwork.layers.length,
      'Undo/Redo does not turn same-project paste into a new layer-tree copy');
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    const moveCanvas = await page.locator('#pa-canvas-main').boundingBox();
    const step = moveCanvas.width / before.meta.cellSize.w;
    await page.mouse.move(moveCanvas.x + moveCanvas.width / 4, moveCanvas.y + moveCanvas.height / 4);
    await page.mouse.down();
    await page.mouse.move(moveCanvas.x + moveCanvas.width / 4 + 2 * step, moveCanvas.y + moveCanvas.height / 4 + step, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.press('Enter');
    await page.locator('#btn-pa-side-code').click();
    const movedAll = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    const expectedMoved = {};
    for (const [key, color] of Object.entries(beforePixels)) {
      const [x, y] = key.split(',').map(Number);
      expectedMoved[`${x + 2},${y + 1}`] = color;
    }
    assert.deepEqual(Object.values(movedAll.cells)[0].pixels, expectedMoved);
    const movedArtwork = Object.values(movedAll.cells)[0];
    const secondLayer = movedArtwork.layers.find(layer => layer.id === 'qa_second_layer');
    assert.deepEqual(secondLayer.children[0].pixels, { '3,2': '#0000ff' },
      'moving across layers preserves the second region and its own pixels');
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    for (let turn = 0; turn < 4; turn++) await page.locator('#btn-rotate-90').click();
    await page.keyboard.press('Enter');
    await page.locator('#btn-pa-side-code').click();
    const rotatedBack = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.deepEqual(Object.values(rotatedBack.cells)[0].layers, movedArtwork.layers,
      'four quarter turns preserve every source region and its pixels');
    await page.locator('#btn-flip-h').click();
    await page.locator('#btn-flip-h').click();
    await page.keyboard.press('Enter');
    const flippedBack = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    assert.deepEqual(Object.values(flippedBack.cells)[0].layers, movedArtwork.layers,
      'two horizontal flips preserve separate source regions');
    await page.locator('#btn-align-left').click();
    const aligned = PIX2.parse(await page.locator('#pa-code-editor').inputValue());
    const alignedArtwork = Object.values(aligned.cells)[0];
    assert.deepEqual(alignedArtwork.layers.find(layer => layer.id === 'qa_second_layer').children[0].pixels,
      { '0,2': '#0000ff' });
    const expectedAligned = {};
    for (const [key, color] of Object.entries(expectedMoved)) {
      const [x, y] = key.split(',').map(Number);
      expectedAligned[`${x - 3},${y}`] = color;
    }
    assert.deepEqual(alignedArtwork.pixels, expectedAligned,
      'alignment translates both layers by the same union offset');
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    const scaleCanvas = await page.locator('#pa-canvas-main').boundingBox();
    await page.mouse.move(scaleCanvas.x + scaleCanvas.width, scaleCanvas.y + scaleCanvas.height);
    await page.mouse.down();
    await page.mouse.move(scaleCanvas.x + scaleCanvas.width / 2 - 1, scaleCanvas.y + scaleCanvas.height / 2 - 1, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.press('Enter');
    await page.locator('#btn-pa-side-code').click();
    const scaledArtwork = Object.values(PIX2.parse(await page.locator('#pa-code-editor').inputValue()).cells)[0];
    const transform = require('../../js/selection-transform.js');
    for (const layer of alignedArtwork.layers) {
      const scaledLayer = scaledArtwork.layers.find(node => node.id === layer.id);
      assert.ok(scaledLayer, 'scaling preserves the original layer ID');
      for (const region of layer.children) assert.deepEqual(scaledLayer.children.find(node => node.id === region.id).pixels,
        transform.scalePixelsNearestNeighbor(region.pixels, 64, 64, 32, 32), 'scale preserves each region source');
    }
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.locator('#pa-btn-project-new-tab').click();
    await page.locator('#btn-confirm-new-canvas').click();
    await page.keyboard.press('Control+v');
    await page.locator('#btn-pa-side-code').click();
    const pastedProject = PIX2.parseValidated(await page.locator('#pa-code-editor').inputValue(), { profile: 'pixelart' });
    const pastedArtwork = Object.values(pastedProject.cells)[0];
    assert.equal(pastedArtwork.layers.length, scaledArtwork.layers.length + 1,
      'cross-project paste retains independent source layers alongside the new canvas layer');
    assert.deepEqual(pastedArtwork.pixels, scaledArtwork.pixels,
      'cross-project layered paste retains the rendered pixels');
    await page.locator('[data-tool="select-all-layers"]').click();
    await page.keyboard.press('Control+a');
    const cancelCanvas = await page.locator('#pa-canvas-main').boundingBox();
    await page.mouse.move(cancelCanvas.x + cancelCanvas.width / 4, cancelCanvas.y + cancelCanvas.height / 4);
    await page.mouse.down();
    await page.mouse.move(cancelCanvas.x + cancelCanvas.width / 4 + 8, cancelCanvas.y + cancelCanvas.height / 4 + 8);
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await page.locator('#btn-pa-side-code').click();
    const cancelledArtwork = Object.values(PIX2.parse(await page.locator('#pa-code-editor').inputValue()).cells)[0];
    assert.deepEqual(cancelledArtwork.layers, pastedArtwork.layers, 'Escape restores every source after a cross-project paste and move');
    assert.deepEqual(errors, []);
    console.log('PixelArt PIX2 conversion and Undo/Redo PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
