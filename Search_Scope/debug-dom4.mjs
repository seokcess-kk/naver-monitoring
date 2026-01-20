import puppeteer from 'puppeteer';

const PLACE_ID = '1066131280';
const URL = `https://m.place.naver.com/place/${PLACE_ID}/review/visitor`;

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915 });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  
  console.log('Navigating to:', URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  const checks = await page.evaluate(() => {
    return {
      'li.place_apply_pui.EjjAW': document.querySelectorAll('li.place_apply_pui.EjjAW').length,
      'li.place_apply_pui': document.querySelectorAll('li.place_apply_pui').length,
      'li.EjjAW': document.querySelectorAll('li.EjjAW').length,
      'li': document.querySelectorAll('li').length,
      'time': document.querySelectorAll('time').length,
      'time[aria-hidden]': document.querySelectorAll('time[aria-hidden]').length,
    };
  });
  
  console.log('\n=== ELEMENT COUNTS ===');
  Object.entries(checks).forEach(([sel, count]) => {
    console.log(`  ${sel}: ${count}`);
  });
  
  // Sample time element content
  if (checks['time'] > 0) {
    const times = await page.evaluate(() => {
      const els = document.querySelectorAll('time');
      return Array.from(els).slice(0, 10).map(t => t.textContent?.trim());
    });
    console.log('\n=== TIME TEXTS ===');
    times.forEach((t, i) => console.log(`  [${i}] "${t}"`));
  }
  
  // Check for review with date
  if (checks['li.place_apply_pui'] > 0 || checks['li'] > 0) {
    const reviews = await page.evaluate(() => {
      const lis = document.querySelectorAll('li.place_apply_pui, li.EjjAW');
      if (lis.length === 0) return [];
      
      return Array.from(lis).slice(0, 5).map((li, i) => {
        const timeEl = li.querySelector('time[aria-hidden="true"]') || li.querySelector('time');
        return {
          index: i,
          class: li.className,
          hasTime: !!timeEl,
          timeText: timeEl?.textContent?.trim() || 'N/A'
        };
      });
    });
    
    console.log('\n=== REVIEW LI ELEMENTS ===');
    reviews.forEach(r => console.log(`  [${r.index}] class="${r.class}" time="${r.timeText}"`));
  }
  
  await browser.close();
}

test().catch(e => console.error(e));
