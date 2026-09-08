import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1320,height:600},deviceScaleFactor:1});
  await page.goto(process.env.BOOKING_PREVIEW_URL || 'http://127.0.0.1:3002');
  await page.locator('.hero').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:'banner.png'});
} finally {
  await browser.close();
}
