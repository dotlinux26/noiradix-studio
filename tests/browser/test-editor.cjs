const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const PIX2 = require('../../js/pix2-format.js');
const fixture = `@pix2 1.1
@meta
  title: "Editor QA"
@grid
  cols: 1
  rows: 1
  default_cell: 16x16
@cell cell_0_0
@layer back
  cell: cell_0_0
  name: "Back"
@region background
  cell: cell_0_0
  parent: back
  p 2,2 #0000ff
  p 10,10 #0000ff
@layer front
  cell: cell_0_0
  name: "Front"
@region red
  cell: cell_0_0
  parent: front
  p 2,2 #ff0000
@region green
  cell: cell_0_0
  parent: front
  p 5,2 #00ff00
`;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    let studioTools;
    const studioCircles = new Map();
    for (const pa of [false, true]) {
      const name = pa ? 'PixelArt' : 'Studio';
      const page = await browser.newPage({
        viewport: { width: 1440, height: 950 },
        deviceScaleFactor: Number(process.env.EDITOR_QA_DPR || 1),
        acceptDownloads: true,
      });
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', (e) => {
        errors.push(e.stack);
        console.log(e.stack);
      });
      page.on('dialog', (dialog) => dialog.accept());
      if (!pa)
        await page.addInitScript(
          (content) =>
            localStorage.setItem(
              'noiradix_open_project_sessions',
              JSON.stringify({
                activeId: 'fixture',
                sessions: [
                  {
                    id: 'fixture',
                    title: 'Editor QA',
                    fileName: 'fixture.pix2',
                    content,
                    activeTabId: 'cell_0_0',
                    openCellTabs: ['cell_0_0'],
                  },
                ],
              }),
            ),
          fixture,
        );
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
        route.abort(),
      );
      await page.goto('http://127.0.0.1:8769' + (pa ? '/pixelart/' : '/'), {
        waitUntil: 'domcontentloaded',
      });
      if (pa) {
        await page.locator('#pa-hidden-file-input').setInputFiles({
          name: 'fixture.pix2',
          mimeType: 'text/plain',
          buffer: Buffer.from(fixture),
        });
        await page.waitForFunction(() =>
          document
            .querySelector('#pa-code-editor')
            .value.includes('@region green'),
        );
      }
      await page.waitForTimeout(600);
      const about = page
        .locator('#btn-about-close-done, #btn-pa-about-close-done')
        .filter({ visible: true });
      if (await about.count()) await about.first().click();
      const canvas = page.locator(pa ? '#pa-canvas-main' : '#cell-overlay');
      await canvas.waitFor({ state: 'visible' });
      const source = () =>
        page.evaluate(
          (pa) =>
            pa
              ? document.querySelector('#pa-code-editor').value
              : PIX2.serialize(state.doc),
          pa,
        );
      const doc = async () => PIX2.parse(await source());
      const node = async (id) => {
        const d = await doc();
        const c = Object.values(d.cells)[0];
        return require('../../js/structure-operations.js').findNode(c, id)
          ?.node;
      };
      const selectLayer = (layer) =>
        page
          .getByText(layer, { exact: true })
          .filter({ visible: true })
          .last()
          .click();
      await selectLayer('Front');
      const rail = page.locator('.editor-tool-rail');
      const catalog = await rail.locator('button').evaluateAll((buttons) =>
        buttons.map(
          (button) =>
            button.dataset.tool ||
            {
              'btn-symmetry-toggle': 'btn-toggle-sym-h',
              'btn-clear-cell': 'btn-clear-canvas',
            }[button.id] ||
            button.id,
        ),
      );
      if (pa)
        assert.deepEqual(
          catalog,
          studioTools,
          'Both tools rails expose the same ordered commands',
        );
      else studioTools = catalog;
      const railButton = rail.locator('[data-tool="eraser"]');
      const railBox = await railButton.boundingBox();
      assert.equal(
        railBox.width,
        railBox.height,
        name + ' square tool buttons',
      );
      await railButton.hover();
      assert.equal(
        await railButton.evaluate((el) => getComputedStyle(el).cursor),
        'grab',
      );
      const railStart = await rail
        .locator('[data-tool="rect-fill"]')
        .boundingBox();
      await page.mouse.move(
        railStart.x + railStart.width / 2,
        railStart.y + railStart.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        railStart.x + railStart.width / 2,
        railStart.y - 120,
        { steps: 5 },
      );
      assert.equal(
        await rail.evaluate((el) => getComputedStyle(el).cursor),
        'grabbing',
      );
      await page.mouse.up();
      assert.ok(await rail.evaluate((el) => el.scrollTop > 0));
      assert.ok(
        await rail
          .locator('[data-tool="pen"]')
          .evaluate((el) => el.classList.contains('active')),
      );
      await rail.evaluate((el) => {
        el.scrollTop = 0;
      });
      const splitter = page.locator(
        pa ? '#pa-split-resizer' : '#cell-inspector-resizer',
      );
      const inspector = page.locator(
        pa ? '#pa-code-pane' : '#view-cell-editor .right-sidebar',
      );
      const startWidth = (await inspector.boundingBox()).width;
      if (!pa) {
        assert.ok(startWidth >= 350, 'Studio defaults to a wider inspector');
        const preview = page.locator('#mini-preview-viewport');
        const canvasPreview = page.locator('#mini-preview-canvas');
        const previewWidth = (await canvasPreview.boundingBox()).width;
        await page.locator('#preview-zoom-in').click();
        assert.ok((await canvasPreview.boundingBox()).width > previewWidth);
        assert.equal(
          await canvasPreview.evaluate((el) => el.width),
          16,
          'Zoom keeps native backing resolution',
        );
        const previewHeight = (await preview.boundingBox()).height;
        const previewGrip = await page
          .locator('#mini-preview-resizer')
          .boundingBox();
        await page.mouse.move(
          previewGrip.x + previewGrip.width / 2,
          previewGrip.y + previewGrip.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          previewGrip.x + previewGrip.width / 2,
          previewGrip.y + 40,
        );
        await page.mouse.up();
        assert.ok((await preview.boundingBox()).height >= previewHeight + 30);
        await page.locator('#preview-zoom-fit').click();
        await page.locator('#mini-preview-resizer').press('ArrowUp');
      }
      const grip = await splitter.boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + 45);
      await page.mouse.down();
      await page.mouse.move(grip.x - 60, grip.y + 45, { steps: 5 });
      await page.mouse.up();
      assert.ok(
        (await inspector.boundingBox()).width > startWidth + 35,
        name + ' inspector resize',
      );
      const point = async (x, y) => {
        const b = await canvas.boundingBox();
        const dims = await doc();
        return {
          x: b.x + ((x + 0.5) * b.width) / dims.meta.cellSize.w,
          y: b.y + ((y + 0.5) * b.height) / dims.meta.cellSize.h,
        };
      };
      const click = async (x, y, options) => {
        const p = await point(x, y);
        await page.mouse.click(p.x, p.y, options);
      };
      const overlay = page.locator(pa ? '#pa-canvas-preview' : '#cell-overlay');
      const dragPixels = async (x0, y0, x1, y1) => {
        const from = await point(x0, y0);
        const to = await point(x1, y1);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 5 });
        await page.mouse.up();
      };
      const rotate = page.locator('#btn-rotate-90');
      for (const moveFirst of [false, true]) {
        await page.locator('[data-tool="select"]').click();
        await dragPixels(2, 2, 7, 6);
        if (moveFirst) await dragPixels(3, 5, 5, 8);
        await rotate.click();
        if (pa || moveFirst) await page.keyboard.press('Enter');
        const key = moveFirst ? '8,5' : '6,2';
        assert.deepEqual(
          (await node('red')).pixels,
          { [key]: '#ff0000' },
          name + ' toolbar rotates marquee',
        );
        await page.keyboard.press('Control+z');
        assert.deepEqual((await node('red')).pixels, { '2,2': '#ff0000' });
        await page.keyboard.press('Escape');
      }
      await page.locator('[data-tool="pen"]').click();
      await rotate.click();
      assert.deepEqual(
        (await node('red')).pixels,
        { '13,2': '#ff0000' },
        name + ' toolbar rotates active raster without a marquee',
      );
      await page.keyboard.press('Control+z');
      for (const tool of ['circle', 'circle-fill']) {
        await page.locator(`[data-tool="${tool}"]`).click();
        const from = await point(8, 7);
        const to = await point(12, 11);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 5 });
        const centerAlpha = await overlay.evaluate(
          (c) =>
            c
              .getContext('2d')
              .getImageData(
                Math.floor((c.width * 10.5) / 16),
                Math.floor((c.height * 9.5) / 16),
                1,
                1,
              ).data[3],
        );
        assert.equal(
          centerAlpha > 0,
          tool === 'circle-fill',
          name + ' circle preview center',
        );
        await page.mouse.up();
        const pixels = (await node('red')).pixels;
        assert.equal(
          Object.hasOwn(pixels, '10,9'),
          tool === 'circle-fill',
          name + ' circle commit center',
        );
        for (const key of ['10,7', '10,11', '8,9', '12,9'])
          assert.ok(pixels[key], name + ' ellipse cardinal point');
        for (const key of ['8,7', '12,7', '8,11', '12,11'])
          assert.equal(pixels[key], undefined, name + ' ellipse corner');
        const footprint = Object.keys(pixels).sort();
        if (pa) assert.deepEqual(footprint, studioCircles.get(tool));
        else studioCircles.set(tool, footprint);
        await page.keyboard.press('Control+z');
        assert.deepEqual((await node('red')).pixels, { '2,2': '#ff0000' });
      }
      await page.locator('[data-tool="region-select"]').click();
      assert.deepEqual(await page.locator('.structure-tree-item[data-type="layer"]').evaluateAll(
        rows => rows.map(row => row.dataset.id)), ['front', 'back']);
      assert.ok(await page.locator('.structure-tree-item[data-id="green"]').evaluate(row =>
        row.nextElementSibling?.dataset.id === 'red'));
      await click(2, 2);
      assert.equal(
        await page
          .locator(pa ? '#pa-isolation-banner' : '#isolation-banner')
          .isVisible(),
        false,
        name + ' single click',
      );
      const hasOutline = () =>
        overlay.evaluate((c) =>
          c
            .getContext('2d')
            .getImageData(0, 0, c.width, c.height)
            .data.some((v, i) => i % 4 === 3 && v),
        );
      assert.equal(
        await hasOutline(),
        true,
        name + ' persistent region outline',
      );
      await click(2, 2, { clickCount: 2 });
      await page
        .locator(pa ? '#pa-isolation-banner' : '#isolation-banner')
        .waitFor({ state: 'visible' });
      const readCanvasPixel = async (x, y) =>
        page
          .locator(pa ? '#pa-canvas-main' : '#cell-canvas')
          .evaluate(
            (c, [x, y]) => [
              ...c
                .getContext('2d')
                .getImageData(
                  Math.floor(((x + 0.5) * c.width) / 16),
                  Math.floor(((y + 0.5) * c.height) / 16),
                  1,
                  1,
                ).data,
            ],
            [x, y],
          );
      const hidden = await readCanvasPixel(10, 10);
      assert.ok(
        hidden[0] !== 0 || hidden[2] !== 255 || hidden[3] !== 255,
        name + ' unrelated blue pixel hidden',
      );
      if (pa) {
        await page.locator('#btn-export-png').click();
        await page.locator('#modal-export-png [data-scale="2"]').click();
        const pendingDownload = page.waitForEvent('download');
        await page.locator('#btn-download-png').click();
        const download = await pendingDownload;
        const bytes = await readFile(await download.path());
        const pixel = await page.evaluate(async (data) => {
          const image = await createImageBitmap(
            new Blob([Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0))]),
          );
          const output = new OffscreenCanvas(image.width, image.height);
          const ctx = output.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return [
            image.width,
            image.height,
            ...ctx.getImageData(20, 20, 1, 1).data,
          ];
        }, bytes.toString('base64'));
        assert.deepEqual(
          pixel,
          [32, 32, 0, 0, 255, 255],
          'PNG preserves the other layer and scale during isolation',
        );
      }
      await page.locator('[data-tool="pen"]').click();
      const brushSlider = page.locator('#brush-size-slider');
      await brushSlider.press('Home');
      await brushSlider.press('ArrowRight');
      await brushSlider.press('ArrowRight');
      await brushSlider.press('ArrowRight');
      assert.equal(await page.locator('#brush-size').inputValue(), '4');
      const evenCenter = await point(7.5, 7.5);
      await page.mouse.move(evenCenter.x, evenCenter.y);
      const brushBounds = await overlay.evaluate((canvas) => {
        const { width, height } = canvas;
        const rgba = canvas
          .getContext('2d')
          .getImageData(0, 0, width, height).data;
        let left = width,
          top = height,
          right = -1,
          bottom = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (!rgba[(y * width + x) * 4 + 3]) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
        return [
          (left + right + 1) / 2 / width,
          (top + bottom + 1) / 2 / height,
          (right - left + 1) / width,
        ];
      });
      assert.ok(
        Math.abs(brushBounds[0] - 0.5) < 0.01 &&
          Math.abs(brushBounds[1] - 0.5) < 0.01,
        name + ' brush preview centered',
      );
      assert.ok(
        Math.abs(brushBounds[2] - 4 / 16) < 0.02,
        name + ' brush preview reflects size',
      );
      await page.locator('#brush-size').fill('3');
      await page.locator('#brush-opacity').fill('50');
      await page.locator('#brush-opacity').press('Tab');
      assert.equal(
        await page.locator('#brush-opacity-slider').inputValue(),
        '50',
      );
      await click(13, 13);
      assert.match(
        (await node('red')).pixels['12,12'],
        /^#[a-f0-9]{6}80$/i,
        name + ' isolated brush alpha',
      );
      assert.equal((await node('green')).pixels['12,12'], undefined);
      await page.locator('[data-tool="eraser"]').click();
      await page.locator('#eraser-size').fill('3');
      await page.locator('#eraser-size').press('Tab');
      assert.equal(await page.locator('#eraser-size-slider').inputValue(), '3');
      await click(13, 13);
      assert.deepEqual((await node('red')).pixels, { '2,2': '#ff0000' });
      await page.locator('[data-tool="select"]').click();
      await click(2, 2);
      await page.keyboard.press('Control+x');
      assert.equal(
        (await node('red')).pixels['2,2'],
        undefined,
        name + ' cut edits source region',
      );
      assert.equal(
        (await node('background')).pixels['2,2'],
        '#0000ff',
        name + ' cut preserves the layer below',
      );
      await page.keyboard.press('Control+z');
      assert.equal(
        (await node('red')).pixels['2,2'],
        '#ff0000',
        name + ' undo restores the region',
      );
      await page.keyboard.press('Escape');
      await page
        .locator(pa ? '#pa-isolation-banner' : '#isolation-banner')
        .waitFor({ state: 'hidden' });
      assert.equal(
        await hasOutline(),
        true,
        name + ' Escape restores focus outline',
      );
      assert.deepEqual(await readCanvasPixel(10, 10), [0, 0, 255, 255]);
      await page
        .locator('.structure-tree-item[data-id="red"] .structure-node-name')
        .click();
      await page
        .locator('.structure-tree-item[data-id="green"] .structure-node-name')
        .click({ modifiers: ['Control'] });
      assert.equal(
        await page.locator('.structure-tree-item.is-selected').count(),
        2,
      );
      const brushSizeInput = page.locator('#brush-size');
      await brushSizeInput.press('Control+g');
      assert.equal(await page.locator('.structure-tree-item[data-type="group"]').count(), 0);
      await brushSizeInput.blur();
      await page.keyboard.press('Control+g');
      const c = Object.values((await doc()).cells)[0];
      const g = c.layers.find((l) => l.id === 'front').children[0];
      assert.equal(g.type, 'group', name + ' group committed');
      const groupName = page.locator(
        '.structure-tree-item[data-type="group"] .structure-node-name',
      );
      await groupName.dblclick();
      const rename = page.getByRole('textbox', { name: 'Rename group' });
      await rename.fill('Foreground parts');
      await rename.press('Enter');
      assert.equal((await node(g.id)).name, 'Foreground parts');
      const p0 = await point(2, 2),
        p1 = await point(3, 4);
      await page.mouse.move(p0.x, p0.y);
      await page.mouse.down();
      await page.mouse.move(p1.x, p1.y, { steps: 4 });
      await page.mouse.up();
      assert.deepEqual(
        (await node('red')).pixels,
        { '3,4': '#ff0000' },
        name + ' group red translation',
      );
      assert.deepEqual(
        (await node('green')).pixels,
        { '6,4': '#00ff00' },
        name + ' group green translation',
      );
      await page.keyboard.press('ArrowRight');
      assert.deepEqual(
        (await node('red')).pixels,
        { '4,4': '#ff0000' },
        name + ' group red nudge',
      );
      assert.deepEqual(
        (await node('green')).pixels,
        { '7,4': '#00ff00' },
        name + ' group green nudge',
      );
      const rotateFrom = await point(5.5, 3.5);
      rotateFrom.y -= 22;
      const rotateTo = await point(8, 4);
      await page.mouse.move(rotateFrom.x, rotateFrom.y);
      await page.mouse.down();
      await page.mouse.move(rotateTo.x, rotateTo.y, { steps: 5 });
      await page.mouse.up();
      assert.notDeepEqual(
        (await node('red')).pixels,
        { '4,4': '#ff0000' },
        name + ' group rotation',
      );
      const StructureOps = require('../../js/structure-operations.js');
      const rotatedBox = StructureOps.bounds(await node(g.id));
      const scaleFrom = await point(
        rotatedBox.x + rotatedBox.w - 0.5,
        rotatedBox.y + rotatedBox.h - 0.5,
      );
      const scaleTo = await point(
        rotatedBox.x + rotatedBox.w + 1,
        rotatedBox.y + rotatedBox.h + 1,
      );
      await page.mouse.move(scaleFrom.x, scaleFrom.y);
      await page.mouse.down();
      await page.mouse.move(scaleTo.x, scaleTo.y, { steps: 5 });
      await page.mouse.up();
      const scaledBox = StructureOps.bounds(await node(g.id));
      assert.ok(
        scaledBox.w > rotatedBox.w && scaledBox.h > rotatedBox.h,
        name + ' group corner resize',
      );
      assert.deepEqual((await node('background')).pixels, {
        '2,2': '#0000ff',
        '10,10': '#0000ff',
      });
      const beforeShrink = await node(g.id);
      const shrinkFrom = await point(scaledBox.x + scaledBox.w - 0.5, scaledBox.y + scaledBox.h - 0.5);
      const shrinkTo = await point(scaledBox.x, scaledBox.y);
      await page.mouse.move(shrinkFrom.x, shrinkFrom.y);
      await page.mouse.down();
      await page.mouse.move(shrinkTo.x, shrinkTo.y, { steps: 5 });
      await page.mouse.up();
      assert.deepEqual(await node(g.id), beforeShrink, name + ' refuses a shrink that would erase a child region');
      await page.keyboard.press('Control+Shift+g');
      assert.equal(await node(g.id), undefined, name + ' ungroup');
      await page.keyboard.press('Control+z');
      assert.ok(await node(g.id), name + ' undo ungroup');
      const [overlapX, overlapY] = Object.keys((await node('red')).pixels)[0].split(',').map(Number);
      await page.locator('.structure-tree-item[data-id="green"] .structure-node-name').click();
      await page.locator('[data-tool="pen"]').click();
      await page.locator('#brush-size').fill('1');
      await page.locator('#brush-opacity').fill('100');
      await page.locator('#brush-opacity').press('Tab');
      await click(overlapX, overlapY);
      await page.locator('[data-tool="region-select"]').click();
      const breadcrumb = page.locator(pa ? '#pa-isolation-breadcrumb' : '#isolation-breadcrumb-text');
      await click(overlapX, overlapY, { clickCount: 2 });
      assert.match(await breadcrumb.innerText(), /green/i);
      await page.keyboard.down('Alt');
      await click(overlapX, overlapY, { clickCount: 2 });
      await page.keyboard.up('Alt');
      assert.match(await breadcrumb.innerText(), /red/i);
      assert.deepEqual(await readCanvasPixel(overlapX, overlapY), [255, 0, 0, 255]);
      await page.keyboard.press('Escape');
      const greenRow = page.locator('.structure-tree-item[data-id="green"]');
      await greenRow.getByRole('button', { name: 'Hide' }).click();
      assert.deepEqual(await readCanvasPixel(overlapX, overlapY), [255, 0, 0, 255]);
      await greenRow.getByRole('button', { name: 'Show' }).click();
      assert.notDeepEqual(await readCanvasPixel(overlapX, overlapY), [255, 0, 0, 255]);
      const opacity = page.locator('.structure-tree-item[data-id="front"] .structure-opacity-input');
      await opacity.fill('50');
      await opacity.press('Tab');
      assert.equal((await node('front')).opacity, 0.5);
      await opacity.fill('0');
      await opacity.press('Tab');
      assert.equal((await node('front')).opacity, 0);
      const back = page.locator('.structure-tree-item[data-id="back"]');
      const front = page.locator('.structure-tree-item[data-id="front"]');
      const frontBox = await front.boundingBox();
      const sourceGrip = await back
        .locator('.structure-drag-grip')
        .boundingBox();
      const targetX = frontBox.x + 36;
      const targetY = frontBox.y + 3;
      await page.mouse.move(
        sourceGrip.x + sourceGrip.width / 2,
        sourceGrip.y + sourceGrip.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(targetX, targetY);
      await page.mouse.up();
      assert.deepEqual(
        Object.values((await doc()).cells)[0].layers.map((layer) => layer.id),
        ['front', 'back'],
      );
      assert.deepEqual(await page.locator('.structure-tree-item[data-type="layer"]').evaluateAll(
        rows => rows.map(row => row.dataset.id)), ['back', 'front']);
      if (pa) {
        await page.locator('#btn-ai-assistant').click();
        assert.match(
          await page.locator('#pa-ai-prompt-text').inputValue(),
          /@pix2 1\.1[\s\S]*@layer[\s\S]*@region/,
        );
      } else {
        const previousZoom = await page.evaluate(() => state.cellZoom);
        await page.keyboard.press('Shift+Space');
        assert.notEqual(
          await page.evaluate(() => state.cellZoom),
          previousZoom,
        );
      }
      if (pa) {
        await page.locator('#modal-ai-assistant .pa-modal-close').click();
        await page.locator('#pa-dim-badge').click();
        await page.locator('#input-resize-w').fill('512');
        await page.locator('#btn-confirm-resize-canvas').click();
      } else {
        await page.locator('#btn-cell-resize-frame').click();
        await page.locator('#resize-frame-w').fill('512');
        await page.locator('#btn-confirm-resize-frame').click();
      }
      await page.waitForFunction(() =>
        document.querySelector('#pa-dim-badge, #label-cell-resolution')?.textContent.startsWith('512'),
      );
      const zoomIn = page.locator('#btn-zoom-in');
      for (let step = 0; step < 8; step++) await zoomIn.click();
      assert.equal(await canvas.evaluate(c => c.width), 4096, name + ' 512px canvas capped at 8×');
      await page.locator('#btn-zoom-out').click();
      assert.equal(await canvas.evaluate(c => c.width), 3072, name + ' 8× to 6× step');
      await page.setViewportSize({ width: 840, height: 950 });
      await page.evaluate(() => {
        window.rulerLabels = [];
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (label, x, y, ...args) {
          if (this.canvas.style.height === '24px' && y === 2) window.rulerLabels.push([label, x]);
          return fillText.call(this, label, x, y, ...args);
        };
      });
      await page.locator(pa ? '#btn-zoom-fit' : '#btn-cell-zoom-fit').click();
      const viewport = page.locator(pa ? '#pa-canvas-viewport' : '#canvas-viewport');
      assert.ok(await canvas.evaluate(c => c.width) < 512, name + ' Fit supports fractional zoom');
      assert.ok((await canvas.boundingBox()).width <= (await viewport.boundingBox()).width, name + ' fitted canvas stays in view');
      const labels = await page.evaluate(() => [...new Map(window.rulerLabels).values()].sort((a, b) => a - b));
      assert.ok(labels.length > 1, name + ' Fit draws ruler labels');
      assert.ok(labels.slice(1).every((x, i) => x - labels[i] >= 40), name + ' Fit keeps ruler labels readable');
      const ruler = page.locator(pa ? '#pa-ruler-top' : '#ruler-top');
      assert.ok(Math.abs((await ruler.boundingBox()).width - (await canvas.boundingBox()).width) <= 1);
      if (!pa) assert.match(await page.locator('#status-zoom-label').textContent(), /% \/ 8×/);
      if (pa) {
        await page.locator('#pa-dim-badge').click();
        await page.locator('#input-resize-h').fill('512');
        await page.locator('#btn-confirm-resize-canvas').click();
      } else {
        await page.locator('#btn-cell-resize-frame').click();
        await page.locator('#resize-frame-h').fill('512');
        await page.locator('#btn-confirm-resize-frame').click();
      }
      await page.locator(pa ? '#btn-zoom-fit' : '#btn-cell-zoom-fit').click();
      if (process.env.EDITOR_QA_DENSE === '1') {
        await selectLayer('Back');
        await page.locator('[data-tool="bucket"]').click();
        const artBox = await canvas.boundingBox();
        const pixel = () => page.locator(pa ? '#pa-canvas-main' : '#cell-canvas').evaluate(c => [...c.getContext('2d').getImageData(
          Math.floor(c.width * 0.1), Math.floor(c.height * 0.1), 1, 1
        ).data]);
        const before = await pixel();
        await page.mouse.click(artBox.x + artBox.width * 0.1, artBox.y + artBox.height * 0.1);
        await page.waitForFunction(({ pa, before }) => {
          const c = document.querySelector(pa ? '#pa-canvas-main' : '#cell-canvas');
          return [...c.getContext('2d').getImageData(Math.floor(c.width * 0.1),
            Math.floor(c.height * 0.1), 1, 1).data].some((value, i) => value !== before[i]);
        }, { pa, before });
      }
      const wheelStats = await page.evaluate(async pa => {
        const art = document.querySelector(pa ? '#pa-canvas-main' : '#cell-canvas');
        const view = document.querySelector(pa ? '#pa-canvas-viewport' : '#canvas-viewport');
        const ctx = CanvasRenderingContext2D.prototype;
        const fillRect = ctx.fillRect, drawImage = ctx.drawImage;
        let fills = 0, blits = 0, maxZoomSourceArea = 0, bufferFills = 0;
        ctx.fillRect = function (...args) {
          if (this.canvas === art) fills++;
          else if (!this.canvas.isConnected && this.canvas.width === 512 && this.canvas.height === 512) bufferFills++;
          return fillRect.apply(this, args);
        };
        ctx.drawImage = function (...args) {
          if (this.canvas === art) {
            blits++;
            if (art.width === 4096) maxZoomSourceArea = Math.max(maxZoomSourceArea, args[3] * args[4]);
          }
          return drawImage.apply(this, args);
        };
        const durations = [];
        let maxDrift = 0;
        const drifts = [];
        try {
          for (let i = 0; i < 20; i++) {
            await new Promise(requestAnimationFrame);
            const rect = art.getBoundingClientRect();
            const viewport = view.getBoundingClientRect();
            const clientX = Math.round((Math.max(rect.left, viewport.left) + Math.min(rect.right, viewport.right)) / 2);
            const clientY = Math.round((Math.max(rect.top, viewport.top) + Math.min(rect.bottom, viewport.bottom)) / 2);
            const x = (clientX - rect.left) / rect.width;
            const y = (clientY - rect.top) / rect.height;
            const start = performance.now();
            view.dispatchEvent(new WheelEvent('wheel', { clientX, clientY, deltaY: i < 10 ? -100 : 100, cancelable: true }));
            const duration = performance.now() - start;
            const next = art.getBoundingClientRect();
            if (rect.width !== next.width) durations.push(duration);
            const drift = Math.max(Math.abs(next.left + next.width * x - clientX), Math.abs(next.top + next.height * y - clientY));
            if (drift > 2) drifts.push({ i, drift, x, y, left: rect.left, top: rect.top, nextLeft: next.left, nextTop: next.top, width: rect.width, nextWidth: next.width, scroll: [view.scrollLeft, view.scrollTop] });
            maxDrift = Math.max(maxDrift, drift);
          }
        } finally {
          ctx.fillRect = fillRect;
          ctx.drawImage = drawImage;
        }
        durations.sort((a, b) => a - b);
        return { fills, blits, maxZoomSourceArea, bufferFills, maxDrift, drifts, p95: durations[Math.ceil(durations.length * 0.95) - 1] };
      }, pa);
      assert.ok(wheelStats.blits >= 16, name + ' zoom in and out repaints the artwork buffer');
      assert.equal(wheelStats.fills, wheelStats.blits, name + ' wheel uses one background fill per blit');
      assert.equal(wheelStats.bufferFills, 0, name + ' wheel reuses the existing artwork buffer');
      assert.ok(wheelStats.maxZoomSourceArea > 0 && wheelStats.maxZoomSourceArea < 512 * 512, name + ' culls artwork at 8×');
      assert.ok(wheelStats.maxDrift <= 2, name + ' pointer anchor stays within 2 CSS px: ' + JSON.stringify(wheelStats));
      console.log(name + ' 512×512 wheel handler ' + JSON.stringify(wheelStats));
      await page.locator('[data-tool="pan"]').click();
      const panStart = await canvas.boundingBox();
      await page.mouse.move(panStart.x + panStart.width / 2, panStart.y + panStart.height / 2);
      await page.mouse.down();
      await page.mouse.move(panStart.x + panStart.width / 2 + 36, panStart.y + panStart.height / 2 + 24, { steps: 4 });
      await page.mouse.up();
      const panEnd = await canvas.boundingBox();
      assert.ok(Math.abs(panEnd.x - panStart.x - 36) <= 1 && Math.abs(panEnd.y - panStart.y - 24) <= 1, name + ' hand pan stays aligned');
      assert.deepEqual(errors, [], name + ' console exceptions');
      console.log(
        name +
          ' PASS selection / isolation / brush alpha / eraser / group drag / ungroup / undo / layer opacity',
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
