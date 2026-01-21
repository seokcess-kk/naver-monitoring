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
  
  // Wait for reviews to load
  await page.waitForSelector('li.place_apply_pui', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  
  // Extract with new selectors
  const data = await page.evaluate(() => {
    const reviewElements = document.querySelectorAll('li.place_apply_pui.EjjAW') ||
                          document.querySelectorAll('li.place_apply_pui') ||
                          document.querySelectorAll('li.EjjAW');
    
    const results = [];
    reviewElements.forEach((el, i) => {
      if (i >= 10) return; // Only first 10
      
      // Get time element
      const timeEl = el.querySelector('time[aria-hidden="true"]') || el.querySelector('time');
      const date = timeEl ? timeEl.textContent.trim() : 'NOT FOUND';
      
      // Get text preview
      const textEl = el.textContent || '';
      const preview = textEl.substring(0, 50).replace(/\s+/g, ' ');
      
      results.push({ index: i, date, preview });
    });
    
    return {
      totalReviews: reviewElements.length,
      samples: results
    };
  });
  
  console.log('\n=== DATE EXTRACTION TEST ===');
  console.log(`Total reviews found: ${data.totalReviews}`);
  console.log('\nSample extractions:');
  data.samples.forEach(r => {
    console.log(`  [${r.index}] Date: "${r.date}" | Preview: ${r.preview}`);
  });
  
  // Count success rate
  const withDate = data.samples.filter(r => r.date !== 'NOT FOUND').length;
  console.log(`\nSuccess rate: ${withDate}/${data.samples.length} (${Math.round(withDate/data.samples.length*100)}%)`);
  
  await browser.close();
}

test().catch(e => console.error(e));
