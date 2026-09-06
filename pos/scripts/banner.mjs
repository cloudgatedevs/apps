// Captures the catalogue image (banner.png) for the App Store card.
//
//   npm run banner                        # renders scripts/banner-mock.html (a static till mock-up;
//                                         #  the real till sits behind sign-in, so it cannot be screenshotted anonymously)
//   npm run banner -- https://my.pos/     # any URL, e.g. a signed-in till on a public display
//
// Needs Playwright's Chromium once: `npx playwright install chromium`.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || pathToFileURL(path.join(here, 'banner-mock.html')).href;
const out = path.resolve(here, '..', 'banner.png');

const browser = await chromium.launch();
try {
  // Card aspect is 11:5; capture at 2x for crisp thumbnails.
  const page = await browser.newPage({ viewport: { width: 1320, height: 600 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1320, height: 600 } });
  console.log(`banner written to ${out} from ${url}`);
} finally {
  await browser.close();
}
