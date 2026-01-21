import puppeteer from 'puppeteer';

const PLACE_ID = '1066131280';
const URL = `https://m.place.naver.com/restaurant/${PLACE_ID}/review/visitor`;

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36');
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  
  console.log('Navigating to:', URL);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  
  // Wait for reviews
  await page.waitForSelector('ul', { timeout: 10000 }).catch(() => console.log('No UL found'));
  
  // Get element counts
  const checks = await page.evaluate(() => {
    return {
      'li.place_apply_pui.EjjAW': document.querySelectorAll('li.place_apply_pui.EjjAW').length,
      'li.place_apply_pui': document.querySelectorAll('li.place_apply_pui').length,
      'li': document.querySelectorAll('li').length,
      'time': document.querySelectorAll('time').length,
      '[class*="EjjAW"]': document.querySelectorAll('[class*="EjjAW"]').length,
    };
  });
  
  console.log('\n=== ELEMENT COUNTS ===');
  Object.entries(checks).forEach(([sel, count]) => {
    console.log(`  ${sel}: ${count}`);
  });
  
  // If we have li elements, check their classes
  if (checks['li'] > 0) {
    const liClasses = await page.evaluate(() => {
      const lis = document.querySelectorAll('li');
      const classes = new Set();
      lis.forEach(li => {
        if (li.className) classes.add(li.className);
      });
      return Array.from(classes).slice(0, 10);
    });
    console.log('\n=== LI CLASSES ===');
    liClasses.forEach(c => console.log(`  "${c}"`));
  }
  
  // Check for time elements
  if (checks['time'] > 0) {
    const timeTexts = await page.evaluate(() => {
      const times = document.querySelectorAll('time');
      return Array.from(times).slice(0, 5).map(t => t.textContent);
    });
    console.log('\n=== TIME TEXTS ===');
    timeTexts.forEach(t => console.log(`  "${t}"`));
  }
  
  await browser.close();
}

test().catch(e => console.error(e));
