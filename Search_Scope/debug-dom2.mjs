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
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  
  console.log('Navigating to:', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for page to load
  await new Promise(r => setTimeout(r, 3000));
  
  // Check page title and URL
  const title = await page.title();
  const currentUrl = page.url();
  console.log('Page title:', title);
  console.log('Current URL:', currentUrl);
  
  // Get body HTML length
  const bodyLen = await page.evaluate(() => document.body?.innerHTML?.length || 0);
  console.log('Body HTML length:', bodyLen);
  
  // Get first 500 chars of body
  const bodyPreview = await page.evaluate(() => document.body?.innerHTML?.substring(0, 1000) || 'EMPTY');
  console.log('\nBody preview:\n', bodyPreview);
  
  await browser.close();
}

test().catch(e => console.error(e));
