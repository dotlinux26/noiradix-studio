const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const baseUrl = process.env.EDITOR_QA_URL || 'http://127.0.0.1:8769';
  const browser = await chromium.launch({ channel: process.env.EDITOR_QA_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.removeItem('noira_maintenance_dismissed_at'));
    for (const path of ['/index.html', '/pixelart/index.html']) {
      await page.goto(`${baseUrl}${path}`);
      const banner = page.locator('.noira-maintenance-banner');
      await banner.waitFor({ state: 'visible', timeout: 5000 });
      const copy = await banner.innerText();
      assert.match(copy, /Thông báo bản Stable/i);
      assert.match(copy, /lỗi chưa phát hiện/);
      assert.match(copy, /Stable Release Notice/i);
      assert.match(copy, /undiscovered bugs may remain/);
      assert.match(copy, /Nhắc lại sau 3 giờ \/ Reappears after 3 hours/);

      const bugLink = banner.getByRole('link', { name: 'Báo lỗi / Report a bug' });
      assert.equal(await bugLink.getAttribute('href'),
        'https://github.com/dotlinux26/noiradix-studio/issues/new?template=bug_report.yml');
      const discordLink = banner.getByRole('link', { name: 'Discord cộng đồng / Community Discord' });
      assert.equal(await discordLink.getAttribute('href'), 'https://discord.gg/SJwsdGWubF');
      assert.equal(await discordLink.getAttribute('rel'), 'noopener noreferrer');

      const aboutModal = path.startsWith('/pixelart/')
        ? page.locator('#modal-about-pa')
        : page.locator('#modal-about-studio');
      if (await aboutModal.isVisible()) {
        await aboutModal.locator('button').first().click();
      }
      const bugPopupPromise = page.waitForEvent('popup');
      await bugLink.click();
      const bugPopup = await bugPopupPromise;
      await bugPopup.waitForLoadState('domcontentloaded');
      assert.equal(new URL(bugPopup.url()).hostname, 'github.com',
        'Bug report link must receive clicks instead of passing them through to the draggable canvas');
      await bugPopup.close();
      await banner.getByRole('button', { name: 'Got it' }).click();
      await page.waitForFunction(() => !document.querySelector('.noira-maintenance-banner')?.classList.contains('is-visible'));
      assert.ok(await page.evaluate(() => localStorage.getItem('noira_maintenance_dismissed_at')),
        'Dismissing should preserve the existing repeat-interval behavior');
    }
    console.log('PASS bilingual Stable feedback banner, bug/Discord links and dismissal in Studio and PixelArt');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
