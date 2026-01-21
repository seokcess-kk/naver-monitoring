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
  
  // Get raw HTML of review list area
  const html = await page.evaluate(() => {
    // Find all elements that might be review items by looking at their content
    const allElements = document.querySelectorAll('*');
    const reviewItems = [];
    
    for (const el of allElements) {
      const text = el.textContent || '';
      // Look for elements with date-like text
      if (text.includes('일 전') || text.includes('주 전') || text.includes('오늘') || text.includes('어제')) {
        if (el.outerHTML.length < 10000 && el.outerHTML.length > 100) {
          // Check if it has review-like content
          const hasReviewContent = text.length > 50;
          if (hasReviewContent) {
            reviewItems.push({
              tag: el.tagName,
              class: el.className,
              htmlSnippet: el.outerHTML.slice(0, 2000)
            });
          }
        }
      }
    }
    
    return reviewItems.slice(0, 2);
  });
  
  console.log('\n=== Found elements with date text ===\n');
  console.log(JSON.stringify(html, null, 2));
  
  await browser.close();
}

captureDom().catch(console.error);
