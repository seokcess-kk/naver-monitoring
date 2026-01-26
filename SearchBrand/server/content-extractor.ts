import puppeteer, { Browser, Page } from "puppeteer-core";
import axios from "axios";
import pLimit from "p-limit";
import { findChromePath } from "./utils/chrome-finder";

export interface ExtractionResult {
  content: string | null;
  status: "success" | "success_api" | "success_ocr" | "success_metadata" | "failed";
  urlType: string;
  method?: string;
}

export interface ExtractionStats {
  blog: { success: number; failed: number };
  cafe: { success: number; failed: number };
  news: { success: number; failed: number };
  view: { success: number; failed: number };
  ad: { success: number; failed: number };
  other: { success: number; failed: number };
}

function createEmptyStats(): ExtractionStats {
  return {
    blog: { success: 0, failed: 0 },
    cafe: { success: 0, failed: 0 },
    news: { success: 0, failed: 0 },
    view: { success: 0, failed: 0 },
    ad: { success: 0, failed: 0 },
    other: { success: 0, failed: 0 },
  };
}

export class ExtractionStatsCollector {
  private stats: ExtractionStats;

  constructor() {
    this.stats = createEmptyStats();
  }

  update(urlType: string, success: boolean): void {
    const type = urlType as keyof ExtractionStats;
    if (this.stats[type]) {
      if (success) {
        this.stats[type].success++;
      } else {
        this.stats[type].failed++;
      }
    }
  }

  getStats(): ExtractionStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = createEmptyStats();
  }

  logSummary(): void {
    console.log("\n[Extractor] === Extraction Summary ===");

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const [type, data] of Object.entries(this.stats)) {
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
}

export function createExtractionStatsCollector(): ExtractionStatsCollector {
  return new ExtractionStatsCollector();
}

const globalStatsCollector = new ExtractionStatsCollector();

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
  return globalStatsCollector.getStats();
}

export function resetExtractionStats(): void {
  globalStatsCollector.reset();
}

export function logExtractionSummary(): void {
  globalStatsCollector.logSummary();
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

/**
 * 페이지 하단까지 자동 스크롤 (동적 콘텐츠 로딩 트리거)
 */
async function autoScrollToBottom(page: Page, maxScrolls: number = 5): Promise<void> {
  try {
    await page.evaluate(async (maxScrolls) => {
      const scrollDelay = 300;
      let scrollCount = 0;
      let lastHeight = document.body.scrollHeight;
      
      while (scrollCount < maxScrolls) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, scrollDelay));
        
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
        scrollCount++;
      }
      
      window.scrollTo(0, 0);
    }, maxScrolls);
  } catch {
    // 스크롤 실패는 무시
  }
}

/**
 * "더보기/펼치기/전체보기" 버튼 클릭 (접힌 콘텐츠 펼치기)
 */
async function clickExpandButtons(page: Page): Promise<number> {
  try {
    const clickedCount = await page.evaluate(() => {
      const expandTexts = ["더보기", "펼치기", "전체보기", "계속 읽기", "본문 전체보기", "more", "展开"];
      const ariaLabels = ["더보기", "펼치기", "전체보기", "expand", "show more"];
      let clicked = 0;
      
      // 텍스트 기반 버튼 찾기
      const allElements = document.querySelectorAll("button, a, span, div");
      allElements.forEach((el) => {
        const text = el.textContent?.trim().toLowerCase() || "";
        const isExpandText = expandTexts.some(t => text.includes(t.toLowerCase()));
        
        if (isExpandText && el instanceof HTMLElement) {
          const style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden") {
            el.click();
            clicked++;
          }
        }
      });
      
      // aria-label 기반 버튼 찾기
      ariaLabels.forEach((label) => {
        const selector = `[aria-label*="${label}"], [title*="${label}"]`;
        const buttons = document.querySelectorAll(selector);
        buttons.forEach((btn) => {
          if (btn instanceof HTMLElement) {
            const style = window.getComputedStyle(btn);
            if (style.display !== "none" && style.visibility !== "hidden") {
              btn.click();
              clicked++;
            }
          }
        });
      });
      
      // 네이버 블로그 전용 셀렉터
      const naverExpandSelectors = [
        ".se-oglink-summary-container-toggle",
        ".se-module-text-expand",
        ".btn_more",
        ".u_btn_more",
        ".more_btn",
        "[class*='_expand']",
        "[class*='_more']",
      ];
      
      naverExpandSelectors.forEach((sel) => {
        try {
          const elements = document.querySelectorAll(sel);
          elements.forEach((el) => {
            if (el instanceof HTMLElement) {
              el.click();
              clicked++;
            }
          });
        } catch {}
      });
      
      return clicked;
    });
    
    if (clickedCount > 0) {
      console.log(`[Extractor] Clicked ${clickedCount} expand buttons`);
      await delay(500);
    }
    
    return clickedCount;
  } catch {
    return 0;
  }
}

/**
 * 스크롤 + 더보기 클릭 후 콘텐츠 재추출
 */
async function expandAndExtract(
  page: Page,
  selectors: string[],
  initialContent: string | null,
  minLength: number = 100
): Promise<string | null> {
  const initialLen = initialContent?.length || 0;
  
  // 1. 자동 스크롤
  await autoScrollToBottom(page, 5);
  
  // 2. 더보기 버튼 클릭
  await clickExpandButtons(page);
  
  // 3. 추가 대기 (동적 콘텐츠 로딩)
  await delay(800);
  
  // 4. 콘텐츠 재추출
  const newContent = await extractWithSelectors(page, selectors, minLength);
  const newLen = newContent?.length || 0;
  
  if (newLen > initialLen) {
    console.log(`[Extractor] Content expanded: ${initialLen} → ${newLen} chars (+${newLen - initialLen})`);
    return newContent;
  }
  
  return initialContent;
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
  const executablePath = findChromePath();
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

interface BrowserPageOptions {
  url: string;
  userAgent?: "mobile" | "desktop";
  viewport?: { width: number; height: number } | null;
  extraHeaders?: Record<string, string>;
  timeout?: number;
  delayMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  logPrefix?: string;
}

async function withBrowserPage<T>(
  options: BrowserPageOptions,
  callback: (page: Page) => Promise<T>
): Promise<T | null> {
  const {
    url,
    userAgent = "desktop",
    viewport = null,
    extraHeaders,
    timeout = 25000,
    delayMs = 1500,
    waitUntil = "networkidle2",
    logPrefix = "Extractor",
  } = options;

  return browserLimit(async () => {
    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();

      const ua = userAgent === "mobile" ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
      await page.setUserAgent(ua);

      if (viewport) {
        await page.setViewport(viewport);
      }

      if (extraHeaders) {
        await page.setExtraHTTPHeaders(extraHeaders);
      }

      await page.goto(url, { waitUntil, timeout });
      await delay(delayMs);

      return await callback(page);
    } catch (error) {
      console.error(`[${logPrefix}] Extraction failed for ${url}:`, error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
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
      
      await page.goto(url, { waitUntil: "networkidle2", timeout: 12000 });
      
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

async function extractBlogContentMobile(url: string): Promise<string | null> {
  const mobileUrl = convertBlogUrlToMobile(url);
  console.log(`[Extractor] Blog mobile extraction: ${mobileUrl}`);

  return withBrowserPage(
    {
      url: mobileUrl,
      userAgent: "mobile",
      viewport: { width: 390, height: 844 },
      logPrefix: "BlogMobile",
    },
    async (page) => {
      await page.waitForSelector(BLOG_SELECTORS.slice(0, 5).join(", "), { timeout: 8000 }).catch(() => {});

      // 초기 콘텐츠 추출
      const initialContent = await extractWithSelectors(page, BLOG_SELECTORS);
      
      // 스크롤 + 더보기 클릭 후 재추출
      const expandedContent = await expandAndExtract(page, BLOG_SELECTORS, initialContent);
      
      if (expandedContent && expandedContent.length > 100) {
        const cleaned = expandedContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] Blog mobile success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      return null;
    }
  );
}

async function extractBlogContentPC(url: string): Promise<string | null> {
  // PC URL은 원본 URL 유지 (blog.naver.com)
  const pcUrl = url.replace("m.blog.naver.com", "blog.naver.com");
  console.log(`[Extractor] Blog PC extraction: ${pcUrl}`);

  return withBrowserPage(
    {
      url: pcUrl,
      userAgent: "desktop",
      waitUntil: "networkidle2",
      delayMs: 2000,
      logPrefix: "BlogPC",
    },
    async (page) => {
      // PC 블로그는 iframe 내부에 콘텐츠가 있을 수 있음
      const iframeSrc = await page.evaluate(() => {
        const iframe = document.querySelector('iframe#mainFrame') as HTMLIFrameElement;
        return iframe?.getAttribute('src') || '';
      });

      if (iframeSrc) {
        const fullIframeSrc = iframeSrc.startsWith('//')
          ? `https:${iframeSrc}`
          : iframeSrc.startsWith('http')
            ? iframeSrc
            : `https://blog.naver.com${iframeSrc}`;
        
        console.log(`[Extractor] Blog PC navigating to iframe: ${fullIframeSrc}`);
        await page.goto(fullIframeSrc, { waitUntil: "domcontentloaded", timeout: 12000 });
        await delay(1500);
      }

      await page.waitForSelector(BLOG_SELECTORS.slice(0, 5).join(", "), { timeout: 8000 }).catch(() => {});

      // 초기 콘텐츠 추출
      const initialContent = await extractWithSelectors(page, BLOG_SELECTORS);
      
      // 스크롤 + 더보기 클릭 후 재추출
      const expandedContent = await expandAndExtract(page, BLOG_SELECTORS, initialContent);
      
      if (expandedContent && expandedContent.length > 100) {
        const cleaned = expandedContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] Blog PC success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      return null;
    }
  );
}

async function extractBlogContent(url: string): Promise<string | null> {
  // 1. 모바일 추출 시도
  let content = await extractBlogContentMobile(url);
  if (content) return content;
  
  // 2. 모바일 실패 시 PC fallback
  console.log(`[Extractor] Blog mobile failed, trying PC...`);
  content = await extractBlogContentPC(url);
  return content;
}

async function extractCafeContentMobile(url: string): Promise<string | null> {
  const mobileUrl = convertCafeUrlToMobile(url);
  console.log(`[Extractor] Cafe mobile extraction: ${mobileUrl}`);

  return withBrowserPage(
    {
      url: mobileUrl,
      userAgent: "mobile",
      viewport: { width: 390, height: 844 },
      extraHeaders: {
        "Referer": "https://m.search.naver.com/search.naver?where=m_cafe",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      timeout: 30000,
      delayMs: 2500,
      logPrefix: "CafeMobile",
    },
    async (page) => {
      // 초기 콘텐츠 추출
      const initialContent = await extractWithSelectors(page, CAFE_SELECTORS, 20);
      
      // 스크롤 + 더보기 클릭 후 재추출
      const expandedContent = await expandAndExtract(page, CAFE_SELECTORS, initialContent, 20);
      
      const articleContent = expandedContent || initialContent;
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
    }
  );
}

async function extractCafeContentPC(url: string): Promise<string | null> {
  console.log(`[Extractor] Cafe PC extraction: ${url}`);

  return withBrowserPage(
    {
      url,
      userAgent: "desktop",
      extraHeaders: {
        "Referer": "https://search.naver.com/search.naver?where=article",
      },
      waitUntil: "domcontentloaded",
      delayMs: 2000,
      logPrefix: "CafePC",
    },
    async (page) => {
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
        await page.goto(fullIframeSrc, { waitUntil: "networkidle2", timeout: 15000 });
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
    }
  );
}

async function extractCafeContent(url: string): Promise<string | null> {
  let content = await extractCafeContentMobile(url);
  if (content) return content;
  
  console.log(`[Extractor] Mobile cafe failed, trying PC...`);
  content = await extractCafeContentPC(url);
  return content;
}

async function extractNewsContent(url: string): Promise<string | null> {
  const mobileUrl = convertNewsUrlToMobile(url) || url;
  const isMobile = mobileUrl.includes("m.");
  console.log(`[Extractor] News extraction: ${mobileUrl}`);

  return withBrowserPage(
    {
      url: mobileUrl,
      userAgent: isMobile ? "mobile" : "desktop",
      delayMs: 1000,
      logPrefix: "News",
    },
    async (page) => {
      // 초기 콘텐츠 추출
      const initialContent = await extractWithSelectors(page, NEWS_SELECTORS);
      
      // 스크롤 + 더보기 클릭 후 재추출
      const expandedContent = await expandAndExtract(page, NEWS_SELECTORS, initialContent);
      
      if (expandedContent && expandedContent.length > 100) {
        const cleaned = expandedContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] News success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      return null;
    }
  );
}

async function extractViewContent(url: string): Promise<string | null> {
  console.log(`[Extractor] VIEW extraction: ${url}`);

  return withBrowserPage(
    {
      url,
      userAgent: "mobile",
      viewport: { width: 390, height: 844 },
      delayMs: 2000,
      logPrefix: "View",
    },
    async (page) => {
      // 초기 콘텐츠 추출
      const initialContent = await extractWithSelectors(page, VIEW_SELECTORS);
      
      // 스크롤 + 더보기 클릭 후 재추출
      const expandedContent = await expandAndExtract(page, VIEW_SELECTORS, initialContent);
      
      if (expandedContent && expandedContent.length > 100) {
        const cleaned = expandedContent.replace(/\s+/g, " ").trim();
        console.log(`[Extractor] VIEW success: ${cleaned.length} chars`);
        return cleaned.slice(0, 6000);
      }
      return null;
    }
  );
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
  console.log(`[Extractor] Puppeteer fallback: ${url}`);

  return withBrowserPage(
    {
      url,
      userAgent: "desktop",
      logPrefix: "PuppeteerFallback",
    },
    async (page) => {
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
    }
  );
}

interface ExtractionStrategy {
  handler: (url: string) => Promise<string | null>;
  timeout: number;
  retries?: number;
  retryDelay?: number;
  method: string;
  fallback?: {
    handler: (url: string) => Promise<string | null>;
    timeout: number;
    method: string;
  };
}

const EXTRACTION_STRATEGIES: Record<string, ExtractionStrategy> = {
  blog: {
    handler: extractBlogContent,
    timeout: 15000,
    retries: 1,
    retryDelay: 500,
    method: "blog_puppeteer",
  },
  view: {
    handler: extractViewContent,
    timeout: 15000,
    retries: 1,
    retryDelay: 500,
    method: "view_puppeteer",
  },
  cafe: {
    handler: extractCafeContent,
    timeout: 20000,
    retries: 1,
    retryDelay: 500,
    method: "cafe_puppeteer",
  },
  news: {
    handler: extractNewsContent,
    timeout: 15000,
    method: "news_puppeteer",
    fallback: {
      handler: extractGenericContent,
      timeout: 10000,
      method: "news_http",
    },
  },
  other: {
    handler: extractGenericContent,
    timeout: 10000,
    method: "generic_http",
    fallback: {
      handler: extractWithPuppeteer,
      timeout: 15000,
      method: "generic_puppeteer",
    },
  },
};

interface RunExtractionOptions {
  skipFallback?: boolean;
}

async function runExtraction(
  url: string,
  strategy: ExtractionStrategy,
  options: RunExtractionOptions = {}
): Promise<{ content: string | null; method: string }> {
  let content: string | null = null;
  let method = strategy.method;

  if (strategy.retries && strategy.retries > 0) {
    content = await retryWithBackoff(
      () => withTimeout(strategy.handler(url), strategy.timeout, null),
      strategy.retries,
      strategy.retryDelay ?? 1000
    );
  } else {
    content = await withTimeout(strategy.handler(url), strategy.timeout, null);
  }

  if (!content && strategy.fallback && !options.skipFallback) {
    content = await withTimeout(
      strategy.fallback.handler(url),
      strategy.fallback.timeout,
      null
    );
    if (content) {
      method = strategy.fallback.method;
    }
  }

  return { content, method };
}

export interface ExtractContentOptions {
  statsCollector?: ExtractionStatsCollector;
}

export async function extractContent(
  url: string,
  apiDescription?: string,
  options: ExtractContentOptions = {}
): Promise<ExtractionResult> {
  const stats = options.statsCollector || globalStatsCollector;
  const urlType = getUrlType(url);
  console.log(`[Extractor] Starting extraction - Type: ${urlType}, URL: ${url}`);

  try {
    if (urlType === "ad") {
      const adResult = await withTimeout(followAdRedirect(url), 45000, null);
      if (adResult && adResult.finalUrl) {
        console.log(`[Extractor] Ad resolved to: ${adResult.finalUrl}`);
        if (adResult.sponsorName) {
          console.log(`[Extractor] Ad sponsor: ${adResult.sponsorName}`);
        }

        const finalUrlType = getUrlType(adResult.finalUrl);
        const strategy = EXTRACTION_STRATEGIES[finalUrlType] || EXTRACTION_STRATEGIES.other;
        const skipFallback = finalUrlType !== "other";
        const { content } = await runExtraction(adResult.finalUrl, strategy, { skipFallback });
        const extractMethod = `ad_to_${finalUrlType === "other" ? "generic" : finalUrlType}`;

        if (content && content.length > 100) {
          const enhancedContent = adResult.sponsorName
            ? `[광고주: ${adResult.sponsorName}] ${content}`
            : content;
          stats.update("ad", true);
          console.log(`[Extractor] Success - Type: ad, Method: ${extractMethod}, Final: ${adResult.finalUrl}, Chars: ${enhancedContent.length}`);
          return { content: enhancedContent, status: "success", urlType: "ad", method: extractMethod };
        }
      }

      if (apiDescription && apiDescription.length > 50) {
        stats.update("ad", true);
        console.log(`[Extractor] Ad using API description fallback: ${apiDescription.length} chars`);
        return { content: apiDescription, status: "success_api", urlType: "ad", method: "api_fallback" };
      }

      stats.update("ad", false);
      console.log(`[Extractor] Failed - Type: ad, URL: ${url}`);
      return { content: null, status: "failed", urlType: "ad" };
    }

    const strategy = EXTRACTION_STRATEGIES[urlType] || EXTRACTION_STRATEGIES.other;
    const { content: textContent, method } = await runExtraction(url, strategy);

    if (textContent && textContent.length > 100) {
      stats.update(urlType, true);
      console.log(`[Extractor] Success - Type: ${urlType}, Method: ${method}, Chars: ${textContent.length}`);
      return { content: textContent, status: "success", urlType, method };
    }

    if (apiDescription && apiDescription.length > 50) {
      stats.update(urlType, true);
      console.log(`[Extractor] Using API description fallback: ${apiDescription.length} chars`);
      return { content: apiDescription, status: "success_api", urlType, method: "api_fallback" };
    }

    stats.update(urlType, false);
    console.log(`[Extractor] Failed - Type: ${urlType}, URL: ${url}`);
    return { content: null, status: "failed", urlType };
  } catch (error) {
    console.error("[Extractor] Extraction error:", error);

    if (apiDescription && apiDescription.length > 50) {
      stats.update(urlType, true);
      return { content: apiDescription, status: "success_api", urlType, method: "api_fallback" };
    }

    stats.update(urlType, false);
    return { content: null, status: "failed", urlType };
  }
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
