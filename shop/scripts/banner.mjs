// Captures the catalogue image (banner.png) from a running copy of the store, so the App Store
// card shows the real app rather than a mock-up.
//
//   npm run banner                       # screenshots http://localhost:3000
//   npm run banner -- https://my.store   # any URL, e.g. the published app
//
// Needs Playwright's Chromium once: `npx playwright install chromium`.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:3000/';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'banner.png');

const browser = await chromium.launch();
try {
  // Card aspect is 11:5; capture at 2x for crisp thumbnails.
  const page = await browser.newPage({ viewport: { width: 1320, height: 600 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  // Dismiss the cookie notice so it does not sit on top of the hero.
  await page.evaluate(() => {
    try { localStorage.setItem('shop.cookie-consent', 'accepted'); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1320, height: 600 } });
  console.log(`banner written to ${out} from ${url}`);
} finally {
  await browser.close();
}
