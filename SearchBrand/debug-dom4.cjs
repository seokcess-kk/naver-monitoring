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
  
  // Look for elements containing visit date text
  const dateElements = await page.evaluate(() => {
    const results = [];
    const allElements = document.querySelectorAll('*');
    
    for (const el of allElements) {
      const text = (el.textContent || '').trim();
      // Look for date patterns like "1.20.화" or "방문일"
      if ((text.match(/^\d{1,2}\.\d{1,2}\.[월화수목금토일]$/) || text === '방문일') && text.length < 20) {
        results.push({
          tag: el.tagName,
          class: el.className,
          text: text,
          parentClass: el.parentElement?.className || '',
          parentTag: el.parentElement?.tagName || ''
        });
      }
    }
    
    return results.slice(0, 10);
  });
  
  console.log('\n=== Date elements found ===\n');
  console.log(JSON.stringify(dateElements, null, 2));
  
  // Get the HTML snippet around a date element
  const htmlSnippet = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = (el.textContent || '').trim();
      if (text.match(/^\d{1,2}\.\d{1,2}\.[월화수목금토일]$/)) {
        // Go up to find the review container
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          parent = parent.parentElement;
        }
        if (parent) {
          return parent.outerHTML.slice(0, 3000);
        }
      }
    }
    return '';
  });
  
  console.log('\n=== HTML snippet around date ===\n');
  console.log(htmlSnippet);
  
  await browser.close();
}

captureDom().catch(console.error);
