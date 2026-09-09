import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1320,height:720},deviceScaleFactor:1});
  await page.goto(process.env.BOOKING_PREVIEW_URL || 'http://127.0.0.1:3002');
  const hero = page.locator('.discovery-hero');
  await hero.waitFor();
  if (await hero.locator('.hero-photo').count()) await hero.locator('.hero-photo').evaluate(image => image.decode());
  await page.evaluate(() => document.fonts.ready);
  const clip = await hero.evaluate(element => ({
    x: 0,
    y: 0,
    width: document.documentElement.clientWidth,
    height: Math.ceil(element.getBoundingClientRect().bottom),
  }));
  await page.screenshot({path:'banner.png',clip});
} finally {
  await browser.close();
}
