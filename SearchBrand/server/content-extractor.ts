import puppeteer, { Browser, Page } from "puppeteer";
import axios from "axios";
import pLimit from "p-limit";
import { execSync } from "child_process";
import { existsSync } from "fs";

function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }
  
  try {
    const systemPath = execSync('which chromium', { encoding: 'utf8' }).trim();
    if (systemPath && existsSync(systemPath)) {
      return systemPath;
    }
  } catch {
    // System chromium not found
  }
  
  return undefined;
}

export interface ExtractionResult {
  content: string | null;
  status: "success" | "success_api" | "success_ocr" | "success_metadata" | "failed";
  urlType: string;
  method?: string;
}

interface ExtractionStats {
  blog: { success: number; failed: number };
  cafe: { success: number; failed: number };
  news: { success: number; failed: number };
  view: { success: number; failed: number };
  ad: { success: number; failed: number };
  other: { success: number; failed: number };
}

const extractionStats: ExtractionStats = {
  blog: { success: 0, failed: 0 },
  cafe: { success: 0, failed: 0 },
  news: { success: 0, failed: 0 },
  view: { success: 0, failed: 0 },
  ad: { success: 0, failed: 0 },
  other: { success: 0, failed: 0 },
};

const browserLimit = pLimit(3);

const BLOG_SELECTORS = [
  ".se-main-container",
  ".post-view",
  ".se_component_wrap",
  "#postViewArea",
  ".post_ct",
  ".se_textarea",
  ".se-viewer",
  ".se_doc_viewer",
  "article.post",
  ".blog_view",
  ".post-body",
  ".view_wrap",
  "#content-area",
  ".content_view",
  ".post_article",
  ".se-module-text",
];

const CAFE_SELECTORS = [
  ".se-main-container",
  ".article_container",
  ".ArticleContentBox",
  ".post_article",
  ".article_viewer",
  ".ContentRenderer",
  "#ct",
  ".content_area",
  "article",
  ".se-component-content",
  ".article_content",
  "#tbody",
  ".CafeViewer",
  ".cafe_article",
  ".board-contents",
  ".article-body",
];

const CAFE_COMMENT_SELECTORS = [
  ".CommentItem",
  ".comment_list",
  ".CommentBox",
  ".comment_text",
  ".comment_inbox",
  ".ReplyArea",
  ".CommentWriter",
  ".comment_area",
  ".cmt_list",
  ".u_cbox_list",
  ".u_cbox_text_wrap",
  ".u_cbox_contents",
  ".u_cbox_comment_box",
  ".u_cbox_text",
  ".comment_text_view",
  ".cbox_module",
  "#cbox_module",
  ".CommentListItem",
  "[class*='comment']",
  "[class*='Comment']",
  ".reply_box",
  ".reply_text",
];

const NEWS_SELECTORS = [
  "#dic_area",
  "#newsct_article",
  ".newsct_article",
  ".article_body",
  "#articleBodyContents",
  ".news_end",
  ".article_txt",
  "#articeBody",
  ".view_con",
  "#article_body",
  ".article-body",
  ".news_article",
  ".article_view",
  "#news_body_id",
  ".story_news_contents",
  "#articleBody",
];

const VIEW_SELECTORS = [
  ".se-main-container",
  ".post_ct",
  ".content_view",
  "article",
  ".post-body",
  ".se_component_wrap",
  ".influencer_content",
  ".creator_content",
  ".in_content",
  ".post_content",
  "#content",
  ".view_content",
];

const MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function getUrlType(url: string): "blog" | "view" | "news" | "cafe" | "ad" | "other" {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("ader.naver.com")) return "ad";
  if (lowerUrl.includes("blog.naver.com")) return "blog";
  if (lowerUrl.includes("in.naver.com") || lowerUrl.includes("post.naver.com")) return "view";
  if (lowerUrl.includes("news.naver.com") || lowerUrl.includes("n.news.naver.com") || 
      lowerUrl.includes("sports.news.naver.com") || lowerUrl.includes("entertain.naver.com")) return "news";
  if (lowerUrl.includes("cafe.naver.com")) return "cafe";
  return "other";
}

export function getExtractionStats(): ExtractionStats {
  return { ...extractionStats };
}

export function resetExtractionStats(): void {
  Object.keys(extractionStats).forEach((key) => {
    extractionStats[key as keyof ExtractionStats] = { success: 0, failed: 0 };
  });
}

function updateStats(urlType: string, success: boolean): void {
  const type = urlType as keyof ExtractionStats;
  if (extractionStats[type]) {
    if (success) {
      extractionStats[type].success++;
    } else {
      extractionStats[type].failed++;
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch (error) {
      console.log(`[Extractor] Attempt ${attempt + 1} failed, retrying...`);
    }
    if (attempt < maxRetries - 1) {
      await delay(baseDelayMs * Math.pow(2, attempt));
    }
  }
  return null;
}

function convertBlogUrlToMobile(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "blog.naver.com" || urlObj.hostname === "m.blog.naver.com") {
      let blogId: string | null = urlObj.searchParams.get("blogId");
      let logNo: string | null = urlObj.searchParams.get("logNo");
      
      if (!blogId || !logNo) {
        const isPostViewPath = urlObj.pathname.includes("PostView.naver") || 
                               urlObj.pathname.includes("PostView.nhn");
        
        if (!isPostViewPath) {
          const pathParts = urlObj.pathname.split("/").filter(Boolean);
          if (pathParts.length >= 1 && !blogId) blogId = pathParts[0];
          if (pathParts.length >= 2 && /^\d+$/.test(pathParts[1]) && !logNo) logNo = pathParts[1];
        }
      }
      
      if (blogId && logNo) {
        return `https://m.blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
      }
      if (blogId) {
        return `https://m.blog.naver.com/${blogId}`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

function convertCafeUrlToMobile(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "cafe.naver.com" || urlObj.hostname === "m.cafe.naver.com") {
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      
      if (pathParts.length >= 2) {
        const cafeName = pathParts[0];
        const articleId = pathParts[1];
        if (/^\d+$/.test(articleId)) {
          return `https://m.cafe.naver.com/${cafeName}/${articleId}`;
        }
      }
      
      if (urlObj.pathname.includes("ArticleRead")) {
        const clubId = urlObj.searchParams.get("clubid");
        const articleId = urlObj.searchParams.get("articleid");
        if (clubId && articleId) {
          return `https://m.cafe.naver.com/ca-fe/web/cafes/${clubId}/articles/${articleId}`;
        }
      }
      
      if (urlObj.pathname.includes("MobileRead")) {
        return url;
      }
    }
    return url.replace("cafe.naver.com", "m.cafe.naver.com");
  } catch {
    return url;
  }
}

function convertNewsUrlToMobile(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (hostname.startsWith("m.")) return null;
    
    const mobileHostMappings: Record<string, string> = {
      "news.naver.com": "m.news.naver.com",
      "n.news.naver.com": "m.news.naver.com",
      "sports.news.naver.com": "m.sports.naver.com",
      "entertain.naver.com": "m.entertain.naver.com",
    };
    
    const mobileHost = mobileHostMappings[hostname];
    if (mobileHost) return url.replace(hostname, mobileHost);
    return null;
  } catch {
    return null;
  }
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = getChromiumPath();
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  });
}

interface AdRedirectResult {
  finalUrl: string;
  content: string | null;
  sponsorName: string | null;
}

async function resolveAdFinalUrl(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      maxRedirects: 10,
      timeout: 15000,
      headers: { "User-Agent": DESKTOP_USER_AGENT },
      validateStatus: () => true,
    });
    
    const finalUrl = response.request?.res?.responseUrl || response.config?.url;
    if (finalUrl && finalUrl !== url) {
      console.log(`[Extractor] HTTP redirect resolved: ${finalUrl}`);
      return finalUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function followAdRedirect(url: string): Promise<AdRedirectResult | null> {
  const httpFinalUrl = await resolveAdFinalUrl(url);
  if (httpFinalUrl && !httpFinalUrl.includes("ader.naver.com")) {
    console.log(`[Extractor] Ad HTTP resolved to: ${httpFinalUrl}`);
    return { finalUrl: httpFinalUrl, content: null, sponsorName: null };
  }
  
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      console.log(`[Extractor] Following ad redirect with Puppeteer: ${url}`);
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(DESKTOP_USER_AGENT);
      
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      
      let previousUrl = page.url();
      for (let i = 0; i < 5; i++) {
        await delay(1000);
        const currentUrl = page.url();
        if (currentUrl !== previousUrl) {
          console.log(`[Extractor] JS redirect detected: ${currentUrl}`);
          previousUrl = currentUrl;
        } else if (!currentUrl.includes("ader.naver.com")) {
          break;
        }
      }
      
      const finalUrl = page.url();
      console.log(`[Extractor] Ad final URL: ${finalUrl}`);
      
      let sponsorName: string | null = null;
      try {
        sponsorName = await page.evaluate(() => {
          const sponsorSelectors = [
            ".sponsor_name",
            ".advertiser_name", 
            ".ad_sponsor",
            "[class*='sponsor']",
            "[class*='advertiser']",
            ".brand_name",
            ".company_name",
          ];
          for (const sel of sponsorSelectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 1) {
              return el.textContent.trim();
            }
          }
          return null;
        });
      } catch {
        sponsorName = null;
      }
      
      return { finalUrl, content: null, sponsorName };
    } catch (error) {
      console.error("[Extractor] Ad redirect failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

async function extractWithSelectors(page: Page, selectors: string[], minLength: number = 100): Promise<string | null> {
  return page.evaluate((sels, minLen) => {
    for (const selector of sels) {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > minLen) {
        return el.textContent.trim();
      }
    }
    
    const removeElements = document.querySelectorAll("script, style, noscript, header, nav, footer, .gnb, .lnb, .ad, .advertisement");
    removeElements.forEach((el) => el.remove());
    
    const bodyText = document.body?.innerText || "";
    return bodyText.length > minLen ? bodyText : null;
  }, selectors, minLength);
}

async function extractAllComments(page: Page, selectors: string[]): Promise<string | null> {
  return page.evaluate((sels) => {
    const allTexts: string[] = [];
    const seenTexts = new Set<string>();
    
    for (const selector of sels) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const text = el.textContent?.trim();
          if (text && text.length >= 5 && !seenTexts.has(text)) {
            seenTexts.add(text);
            allTexts.push(text);
          }
        });
      } catch (e) {
      }
    }
    
    if (allTexts.length === 0) return null;
    
    const combined = allTexts.join(" ");
    return combined.length > 10 ? combined : null;
  }, selectors);
}

async function extractBlogContent(url: string): Promise<string | null> {
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      const mobileUrl = convertBlogUrlToMobile(url);
      console.log(`[Extractor] Blog extraction: ${mobileUrl}`);

      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(MOBILE_USER_AGENT);
      await page.setViewport({ width: 390, height: 844 });
      
      await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(1500);
      
      await page.waitForSelector(BLOG_SELECTORS.slice(0, 5).join(", "), { timeout: 8000 }).catch(() => {});

      const textContent = await extractWithSelectors(page, BLOG_SELECTORS);
      if (textContent && textContent.length > 100) {
        const cleaned = textContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] Blog success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      
      return null;
    } catch (error) {
      console.error("[Extractor] Blog extraction failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

async function extractCafeContentMobile(url: string): Promise<string | null> {
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      const mobileUrl = convertCafeUrlToMobile(url);
      console.log(`[Extractor] Cafe mobile extraction: ${mobileUrl}`);
      
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(MOBILE_USER_AGENT);
      await page.setViewport({ width: 390, height: 844 });
      
      await page.setExtraHTTPHeaders({
        "Referer": "https://m.search.naver.com/search.naver?where=m_cafe",
        "Accept-Language": "ko-KR,ko;q=0.9",
      });
      
      await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2500);
      
      const articleContent = await extractWithSelectors(page, CAFE_SELECTORS, 20);
      const commentContent = await extractAllComments(page, CAFE_COMMENT_SELECTORS);
      
      let combinedContent = "";
      if (articleContent && articleContent.length > 20) {
        combinedContent += articleContent;
      }
      if (commentContent && commentContent.length > 10) {
        combinedContent += " [댓글] " + commentContent;
        console.log(`[Extractor] Cafe comments found: ${commentContent.length} chars`);
      }
      
      if (combinedContent.length > 20) {
        const cleaned = combinedContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] Cafe mobile success: ${cleaned.length} chars (with comments)`);
        return cleaned.slice(0, 10000);
      }
      
      return null;
    } catch (error) {
      console.error("[Extractor] Cafe mobile extraction failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

async function extractCafeContentPC(url: string): Promise<string | null> {
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      console.log(`[Extractor] Cafe PC extraction: ${url}`);
      
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(DESKTOP_USER_AGENT);
      
      await page.setExtraHTTPHeaders({
        "Referer": "https://search.naver.com/search.naver?where=article",
      });
      
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await delay(2000);
      
      const iframeSrc = await page.evaluate(() => {
        const iframe = document.querySelector('iframe#cafe_main') as HTMLIFrameElement;
        return iframe?.getAttribute('src') || '';
      });
      
      if (iframeSrc) {
        const fullIframeSrc = iframeSrc.startsWith('//') 
          ? `https:${iframeSrc}` 
          : iframeSrc.startsWith('http') 
            ? iframeSrc 
            : `https://cafe.naver.com${iframeSrc}`;
        
        console.log(`[Extractor] Navigating to cafe iframe: ${fullIframeSrc}`);
        await page.goto(fullIframeSrc, { waitUntil: "networkidle2", timeout: 25000 });
        await delay(2000);
      }
      
      const articleContent = await extractWithSelectors(page, CAFE_SELECTORS, 20);
      const commentContent = await extractAllComments(page, CAFE_COMMENT_SELECTORS);
      
      let combinedContent = "";
      if (articleContent && articleContent.length > 20) {
        combinedContent += articleContent;
      }
      if (commentContent && commentContent.length > 10) {
        combinedContent += " [댓글] " + commentContent;
        console.log(`[Extractor] Cafe PC comments found: ${commentContent.length} chars`);
      }
      
      if (combinedContent.length > 20) {
        const cleaned = combinedContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] Cafe PC success: ${cleaned.length} chars (with comments)`);
        return cleaned.slice(0, 10000);
      }
      
      return null;
    } catch (error) {
      console.error("[Extractor] Cafe PC extraction failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

async function extractCafeContent(url: string): Promise<string | null> {
  let content = await extractCafeContentMobile(url);
  if (content) return content;
  
  console.log(`[Extractor] Mobile cafe failed, trying PC...`);
  content = await extractCafeContentPC(url);
  return content;
}

async function extractNewsContent(url: string): Promise<string | null> {
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      const mobileUrl = convertNewsUrlToMobile(url) || url;
      console.log(`[Extractor] News extraction: ${mobileUrl}`);

      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(mobileUrl.includes("m.") ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT);
      
      await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(1000);

      const textContent = await extractWithSelectors(page, NEWS_SELECTORS);
      if (textContent && textContent.length > 100) {
        const cleaned = textContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] News success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      
      return null;
    } catch (error) {
      console.error("[Extractor] News extraction failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

async function extractViewContent(url: string): Promise<string | null> {
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      console.log(`[Extractor] VIEW extraction: ${url}`);

      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(MOBILE_USER_AGENT);
      await page.setViewport({ width: 390, height: 844 });
      
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(2000);

      const textContent = await extractWithSelectors(page, VIEW_SELECTORS);
      if (textContent && textContent.length > 100) {
        const cleaned = textContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] VIEW success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      
      return null;
    } catch (error) {
      console.error("[Extractor] VIEW extraction failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

async function extractGenericContent(url: string): Promise<string | null> {
  try {
    console.log(`[Extractor] HTTP extraction: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": DESKTOP_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      maxRedirects: 5,
    });

    if (response.status >= 400) return null;

    const html = response.data as string;
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (textContent.length > 200) {
      console.log(`[Extractor] HTTP success: ${textContent.length} chars`);
      return textContent.slice(0, 6000);
    }
    return null;
  } catch {
    return null;
  }
}

async function extractWithPuppeteer(url: string): Promise<string | null> {
  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      console.log(`[Extractor] Puppeteer fallback: ${url}`);
      
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(DESKTOP_USER_AGENT);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(1500);

      const textContent = await page.evaluate(() => {
        const removeElements = document.querySelectorAll("script, style, noscript, header, nav, footer");
        removeElements.forEach((el) => el.remove());
        return document.body?.innerText || "";
      });

      if (textContent && textContent.length > 100) {
        const cleaned = textContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] Puppeteer fallback success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      
      return null;
    } catch (error) {
      console.error("[Extractor] Puppeteer fallback failed:", error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  });
}

export async function extractContent(
  url: string, 
  apiDescription?: string
): Promise<ExtractionResult> {
  const urlType = getUrlType(url);
  console.log(`[Extractor] Starting extraction - Type: ${urlType}, URL: ${url}`);
  
  try {
    let textContent: string | null = null;
    let method: string = "";
    
    if (urlType === "ad") {
      const adResult = await withTimeout(followAdRedirect(url), 45000, null);
      if (adResult && adResult.finalUrl) {
        console.log(`[Extractor] Ad resolved to: ${adResult.finalUrl}`);
        if (adResult.sponsorName) {
          console.log(`[Extractor] Ad sponsor: ${adResult.sponsorName}`);
        }
        
        const finalUrlType = getUrlType(adResult.finalUrl);
        let extractedContent: string | null = null;
        let extractMethod = "ad_redirect";
        
        if (finalUrlType === "blog") {
          extractedContent = await retryWithBackoff(
            () => withTimeout(extractBlogContent(adResult.finalUrl), 40000, null),
            2, 1000
          );
          extractMethod = "ad_to_blog";
        } else if (finalUrlType === "view") {
          extractedContent = await retryWithBackoff(
            () => withTimeout(extractViewContent(adResult.finalUrl), 40000, null),
            2, 1000
          );
          extractMethod = "ad_to_view";
        } else if (finalUrlType === "cafe") {
          extractedContent = await retryWithBackoff(
            () => withTimeout(extractCafeContent(adResult.finalUrl), 60000, null),
            2, 1500
          );
          extractMethod = "ad_to_cafe";
        } else if (finalUrlType === "news") {
          extractedContent = await withTimeout(extractNewsContent(adResult.finalUrl), 35000, null);
          extractMethod = "ad_to_news";
        } else {
          extractedContent = await withTimeout(extractGenericContent(adResult.finalUrl), 20000, null);
          if (!extractedContent) {
            extractedContent = await withTimeout(extractWithPuppeteer(adResult.finalUrl), 35000, null);
          }
          extractMethod = "ad_to_generic";
        }
        
        if (extractedContent && extractedContent.length > 100) {
          let enhancedContent = extractedContent;
          if (adResult.sponsorName) {
            enhancedContent = `[광고주: ${adResult.sponsorName}] ${enhancedContent}`;
          }
          updateStats("ad", true);
          console.log(`[Extractor] Success - Type: ad, Method: ${extractMethod}, Final: ${adResult.finalUrl}, Chars: ${enhancedContent.length}`);
          return { content: enhancedContent, status: "success", urlType: "ad", method: extractMethod };
        }
      }
      
      if (apiDescription && apiDescription.length > 50) {
        updateStats("ad", true);
        console.log(`[Extractor] Ad using API description fallback: ${apiDescription.length} chars`);
        return { content: apiDescription, status: "success_api", urlType: "ad", method: "api_fallback" };
      }
      
      updateStats("ad", false);
      console.log(`[Extractor] Failed - Type: ad, URL: ${url}`);
      return { content: null, status: "failed", urlType: "ad" };
    }
    
    if (urlType === "blog") {
      textContent = await retryWithBackoff(
        () => withTimeout(extractBlogContent(url), 40000, null),
        2, 1000
      );
      method = "blog_puppeteer";
    } else if (urlType === "view") {
      textContent = await retryWithBackoff(
        () => withTimeout(extractViewContent(url), 40000, null),
        2, 1000
      );
      method = "view_puppeteer";
    } else if (urlType === "cafe") {
      textContent = await retryWithBackoff(
        () => withTimeout(extractCafeContent(url), 60000, null),
        2, 1500
      );
      method = "cafe_puppeteer";
    } else if (urlType === "news") {
      textContent = await withTimeout(extractNewsContent(url), 35000, null);
      if (!textContent) {
        textContent = await withTimeout(extractGenericContent(url), 20000, null);
        method = "news_http";
      } else {
        method = "news_puppeteer";
      }
    } else {
      textContent = await withTimeout(extractGenericContent(url), 20000, null);
      if (!textContent) {
        textContent = await withTimeout(extractWithPuppeteer(url), 35000, null);
        method = "generic_puppeteer";
      } else {
        method = "generic_http";
      }
    }
    
    if (textContent && textContent.length > 100) {
      updateStats(urlType, true);
      console.log(`[Extractor] Success - Type: ${urlType}, Method: ${method}, Chars: ${textContent.length}`);
      return { content: textContent, status: "success", urlType, method };
    }
    
    if (apiDescription && apiDescription.length > 50) {
      updateStats(urlType, true);
      console.log(`[Extractor] Using API description fallback: ${apiDescription.length} chars`);
      return { content: apiDescription, status: "success_api", urlType, method: "api_fallback" };
    }
    
    updateStats(urlType, false);
    console.log(`[Extractor] Failed - Type: ${urlType}, URL: ${url}`);
    return { content: null, status: "failed", urlType };
    
  } catch (error) {
    console.error("[Extractor] Extraction error:", error);
    
    if (apiDescription && apiDescription.length > 50) {
      updateStats(urlType, true);
      return { content: apiDescription, status: "success_api", urlType, method: "api_fallback" };
    }
    
    updateStats(urlType, false);
    return { content: null, status: "failed", urlType };
  }
}

export function logExtractionSummary(): void {
  const stats = getExtractionStats();
  console.log("\n[Extractor] === Extraction Summary ===");
  
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const [type, data] of Object.entries(stats)) {
    const total = data.success + data.failed;
    if (total > 0) {
      const rate = ((data.success / total) * 100).toFixed(1);
      console.log(`[Extractor] ${type}: ${data.success}/${total} (${rate}%)`);
      totalSuccess += data.success;
      totalFailed += data.failed;
    }
  }
  
  const total = totalSuccess + totalFailed;
  if (total > 0) {
    const overallRate = ((totalSuccess / total) * 100).toFixed(1);
    console.log(`[Extractor] Overall: ${totalSuccess}/${total} (${overallRate}%)`);
  }
  console.log("[Extractor] ========================\n");
}

export interface MetadataResult {
  title: string | null;
  description: string | null;
  success: boolean;
}

export async function extractMetadata(url: string): Promise<MetadataResult> {
  try {
    console.log(`[Extractor] Extracting metadata from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": DESKTOP_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });
    
    const html = response.data;
    if (typeof html !== "string") {
      console.log(`[Extractor] Metadata extraction failed: response is not HTML`);
      return { title: null, description: null, success: false };
    }
    
    let title: string | null = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }
    
    let description: string | null = null;
    const descPatterns = [
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i,
    ];
    
    for (const pattern of descPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        description = match[1].trim();
        break;
      }
    }
    
    if (title || description) {
      console.log(`[Extractor] Metadata success - Title: ${title?.length || 0} chars, Desc: ${description?.length || 0} chars`);
      return { title, description, success: true };
    }
    
    console.log(`[Extractor] Metadata extraction: no title or description found`);
    return { title: null, description: null, success: false };
    
  } catch (error) {
    console.log(`[Extractor] Metadata extraction failed for ${url}:`, error instanceof Error ? error.message : "Unknown error");
    return { title: null, description: null, success: false };
  }
}
