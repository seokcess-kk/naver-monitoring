import puppeteer from 'puppeteer';

const PLACE_ID = '1066131280';
const URL = `https://m.place.naver.com/restaurant/${PLACE_ID}/review/visitor`;

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');
  
  console.log('Navigating to:', URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait longer
  await new Promise(r => setTimeout(r, 5000));
  
  // Check what elements exist
  const checks = await page.evaluate(() => {
    return {
      'li.place_apply_pui.EjjAW': document.querySelectorAll('li.place_apply_pui.EjjAW').length,
      'li.place_apply_pui': document.querySelectorAll('li.place_apply_pui').length,
      'li.EjjAW': document.querySelectorAll('li.EjjAW').length,
      'li': document.querySelectorAll('li').length,
      'time': document.querySelectorAll('time').length,
      'time[aria-hidden]': document.querySelectorAll('time[aria-hidden]').length,
      '.pui__vn15t2': document.querySelectorAll('.pui__vn15t2').length,
      'ul': document.querySelectorAll('ul').length,
    };
  });
  
  console.log('\n=== ELEMENT COUNTS ===');
  Object.entries(checks).forEach(([sel, count]) => {
    console.log(`  ${sel}: ${count}`);
  });
  
  // Get sample HTML of first li elements
  const liHTML = await page.evaluate(() => {
    const lis = document.querySelectorAll('li');
    const samples = [];
    for (let i = 0; i < Math.min(3, lis.length); i++) {
      const classes = lis[i].className;
      const hasTime = lis[i].querySelector('time') ? 'YES' : 'NO';
      samples.push({ index: i, classes, hasTime });
    }
    return samples;
  });
  
  console.log('\n=== FIRST LI ELEMENTS ===');
  liHTML.forEach(l => console.log(`  [${l.index}] class="${l.classes}" hasTime=${l.hasTime}`));
  
  await browser.close();
}

test().catch(e => console.error(e));
