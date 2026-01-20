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
  
  // Get full page text content first to see what dates look like
  const pageText = await page.evaluate(() => {
    return document.body.innerText.slice(0, 5000);
  });
  
  console.log('\n=== Page Text Content ===\n');
  console.log(pageText);
  
  await browser.close();
}

captureDom().catch(console.error);
