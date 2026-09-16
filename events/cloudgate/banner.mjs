// Capture the actual public events at the App Store's 11:5 aspect ratio.
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1760,height:800},deviceScaleFactor:1,reducedMotion:'reduce'});
 await page.goto(process.argv[2]||'http://localhost:3007/',{waitUntil:'networkidle'});
 await page.locator('.event-hero h1').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:fileURLToPath(new URL('../banner.png',import.meta.url))});
 console.log('Saved events/banner.png (1760 × 800).');
} finally {await browser.close();}
