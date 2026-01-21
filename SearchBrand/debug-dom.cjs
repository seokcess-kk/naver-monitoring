const puppeteer = require('puppeteer');

async function captureDom() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
  
  const url = 'https://m.place.naver.com/place/1583903630/review/visitor';
  console.log('Navigating to:', url);
  
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const debugInfo = await page.evaluate(() => {
    const reviewItems = document.querySelectorAll('[class*="review"], [class*="Review"], li[class]');
    const results = [];
    
    for (let i = 0; i < Math.min(3, reviewItems.length); i++) {
      const item = reviewItems[i];
      const classList = item.className;
      
      const timeEls = item.querySelectorAll('time');
      const spanEls = item.querySelectorAll('span');
      
      const timeInfo = [];
      timeEls.forEach((el, idx) => {
        timeInfo.push({
          tag: el.tagName,
          class: el.className,
          datetime: el.getAttribute('datetime'),
          text: (el.textContent || '').trim().slice(0, 100)
        });
      });
      
      const spanInfo = [];
      spanEls.forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text.length > 0 && text.length < 30) {
          spanInfo.push({
            class: el.className,
            text: text
          });
        }
      });
      
      results.push({
        itemClass: classList.slice(0, 100),
        timeElements: timeInfo,
        spans: spanInfo.slice(0, 15)
      });
    }
    
    return results;
  });
  
  console.log('\n=== DEBUG: Review DOM Structure ===\n');
  console.log(JSON.stringify(debugInfo, null, 2));
  
  await browser.close();
}

captureDom().catch(console.error);
