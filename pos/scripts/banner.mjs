// Captures the catalogue image (banner.png) for the App Store card.
//
//   npm run banner                              # renders scripts/banner-mock.html (a static till mock-up)
//   npm run banner -- https://my.pos/           # any URL that renders without sign-in
//   npm run banner -- https://my.pos/ --login   # the real till: a browser window opens, YOU sign in,
//                                               #  put two or more items on the sale, and the shot is
//                                               #  taken by itself a moment later
//
// Needs Playwright's Chromium once: `npx playwright install chromium`.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const login = args.includes('--login');
const url = args.find((a) => !a.startsWith('--')) || pathToFileURL(path.join(here, 'banner-mock.html')).href;
const out = path.resolve(here, '..', 'banner.png');

// Card aspect is 11:5; capture at 2x for crisp thumbnails.
const VIEWPORT = { width: 1320, height: 600 };
const WAIT_MS = 10 * 60_000;
const TILL_SELECTOR = 'button[aria-label="Clear sale"]';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The sign-in may redirect, open a popup or replace the tab: find whichever page shows the till. */
async function findTillPage(context, predicate) {
  const started = Date.now();
  while (Date.now() - started < WAIT_MS) {
    for (const p of context.pages()) {
      if (p.isClosed()) continue;
      try {
        if (await p.evaluate(predicate)) return p;
      } catch {
        /* page navigating; try again */
      }
    }
    if (context.pages().every((p) => p.isClosed())) throw new Error('The browser window was closed before the till appeared.');
    await sleep(500);
  }
  throw new Error('Timed out waiting for the till.');
}

const browser = await chromium.launch({ headless: !login });
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  let page = await context.newPage();
  await page.goto(url, { waitUntil: login ? 'load' : 'networkidle', timeout: 60_000 });

  if (login) {
    console.log('Sign in in the browser window. The picture is taken once the till shows a sale with two or more items.');
    page = await findTillPage(context, (sel) => Boolean(document.querySelector(sel)) ? true : false, TILL_SELECTOR).catch(async () => findTillPage(context, () => Boolean(document.querySelector('button[aria-label="Clear sale"]'))));
    console.log('Till is up. Add at least two items to the sale…');
    page = await findTillPage(context, () => {
      const clear = document.querySelector('button[aria-label="Clear sale"]');
      const lines = document.querySelectorAll('aside li, [class*="cart"] li').length;
      return Boolean(clear && !clear.disabled && lines >= 2);
    });
    await page.setViewportSize(VIEWPORT);
    // Camera preview off and no focus ring in the picture.
    await page.evaluate(() => {
      const stop = [...document.querySelectorAll('button')].find((b) => /Stop camera/.test(b.textContent));
      stop?.click();
      document.activeElement?.blur?.();
    });
    await sleep(1200);
  } else {
    await sleep(800);
  }

  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height } });
  console.log(`banner written to ${out} from ${page.url()}`);
} finally {
  await browser.close();
}
