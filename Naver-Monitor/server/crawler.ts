import puppeteer from "puppeteer";
import pLimit from "p-limit";
import LRUCache from "lru-cache";
import { execSync } from "child_process";

interface SmartBlockPost {
  rank: number | null;
  title: string;
  url: string;
  summary: string;
  isPlace?: boolean;
  isNews?: boolean;
  press?: string;
  date?: string;
}

interface SmartBlockSection {
  sectionTitle: string;
  posts: SmartBlockPost[];
}

const crawlLimit = pLimit(2);

const crawlCache = new LRUCache<string, SmartBlockSection[]>({
  max: 100,
  ttl: 5 * 60 * 1000,
});

function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  try {
    const path = execSync('which chromium', { encoding: 'utf8' }).trim();
    if (path) {
      console.log('[Crawler] Using system Chromium:', path);
      return path;
    }
  } catch {
  }
  
  try {
    const puppeteerPath = puppeteer.executablePath();
    if (puppeteerPath) {
      console.log('[Crawler] Using Puppeteer bundled Chromium:', puppeteerPath);
      return puppeteerPath;
    }
  } catch {
  }
  
  console.log('[Crawler] No Chromium found, using Puppeteer default');
  return undefined;
}

async function executeCrawl(keyword: string): Promise<SmartBlockSection[]> {
  let browser = null;

  try {
    const executablePath = getChromiumPath();
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const sections = await page.evaluate(() => {
      const results: SmartBlockSection[] = [];
      const processedElements = new Set<Element>();

      // 1. 플레이스(지도) 영역 추출
      const placeSection =
        document.querySelector("#loc-main-section-root") ||
        document.querySelector("#place-main-section-root") ||
        document.querySelector('[data-laim-exp-id*="loc_plc"]') ||
        document.querySelector('[data-laim-exp-id*="nmb_hpl"]') ||
        document.querySelector('.api_subject_bx[data-template-type="place"]');

      if (placeSection) {
        processedElements.add(placeSection);
        const placePosts: SmartBlockPost[] = [];
        const listItems = placeSection.querySelectorAll("li");

        let rankCounter = 1;
        listItems.forEach((li) => {
          try {
            const docId =
              li.getAttribute("data-loc_plce-doc-id") ||
              li.getAttribute("data-loc_plc-doc-id") ||
              li.getAttribute("data-nmb_hpl-doc-id") ||
              li.getAttribute("data-doc-id") ||
              "";

            if (
              docId.includes("nad") ||
              li.classList.contains("type_ad") ||
              li.getAttribute("data-nclk")?.includes("ads")
            )
              return;

            const nameEl =
              li.querySelector(".YwYLL") ||
              li.querySelector(".q2LdB") ||
              li.querySelector(".tit_place") ||
              li.querySelector(".place_bluelink");

            const linkEl =
              li.querySelector("a.place_bluelink") ||
              li.querySelector('a[href*="map.naver.com"]') ||
              li.querySelector("a");

            if (nameEl) {
              placePosts.push({
                rank: rankCounter++,
                title: (nameEl as HTMLElement).innerText.trim(),
                url: linkEl ? (linkEl as HTMLAnchorElement).href.split("?")[0] : "#",
                summary: "네이버 플레이스",
                isPlace: true,
              });
            }
          } catch (e) {}
        });

        if (placePosts.length > 0) {
          results.push({
            sectionTitle: "플레이스 (지도)",
            posts: placePosts,
          });
        }
      }

      // 2. 뉴스 영역 추출
      const newsSection =
        document.querySelector('div[data-meta-area="nws_all"]') ||
        document.querySelector(".group_news") ||
        document.querySelector(".news_area");

      if (newsSection) {
        const parentBox = newsSection.closest(".api_subject_bx");
        if (parentBox) processedElements.add(parentBox);

        const newsPosts: SmartBlockPost[] = [];
        const newsItems = newsSection.querySelectorAll(
          ".news_wrap, .bx, .list_news > .bx, .sds-comps-vertical-layout .sds-comps-full-layout.BA4AED65Uniq0oRiPaDB, div[data-template-id='newsItem']"
        );

        newsItems.forEach((item, index) => {
          try {
            let titleEl =
              item.querySelector('a[data-heatmap-target=".tit"]') ||
              item.querySelector(".news_tit") ||
              item.querySelector(".sds-comps-text-type-headline1");

            let anchorEl = titleEl
              ? titleEl.tagName === "A"
                ? titleEl
                : titleEl.closest("a")
              : item.querySelector("a");

            const summaryEl =
              item.querySelector('a[data-heatmap-target=".body"]') ||
              item.querySelector(".dsc_txt_wrap") ||
              item.querySelector(".sds-comps-text-type-body1") ||
              item.querySelector(".api_txt_lines.dsc_txt");

            const pressEl =
              item.querySelector(".info_group .press") ||
              item.querySelector(".sds-comps-profile-info-title-text") ||
              item.querySelector('a[data-heatmap-target=".prof"]');

            const dateEl =
              item.querySelector(".info_group .info") ||
              item.querySelector(".sds-comps-profile-info-subtext");

            if (titleEl && anchorEl && (anchorEl as HTMLAnchorElement).href) {
              newsPosts.push({
                rank: index + 1,
                title: (titleEl as HTMLElement).innerText.trim(),
                url: (anchorEl as HTMLAnchorElement).href,
                summary: summaryEl ? (summaryEl as HTMLElement).innerText.trim() : "",
                isPlace: false,
                isNews: true,
                press: pressEl ? (pressEl as HTMLElement).innerText.trim() : "",
                date: dateEl ? (dateEl as HTMLElement).innerText.trim() : "",
              });
            }
          } catch (e) {}
        });

        if (newsPosts.length > 0) {
          results.push({
            sectionTitle: "뉴스",
            posts: newsPosts,
          });
        }
      }

      // 3. 리뷰 영역 추출 (Fender 렌더링 구조)
      const reviewContainer = document.querySelector('.spw_fsolid[data-slog-container="urB_coR"]');
      
      if (reviewContainer) {
        processedElements.add(reviewContainer);
        const reviewPosts: SmartBlockPost[] = [];
        
        // 각 Fender 루트 요소를 직접 타겟팅
        const fenderRoots = reviewContainer.querySelectorAll('[data-fender-root="true"]');
        
        fenderRoots.forEach((root) => {
          try {
            // 각 루트 내 모든 링크 추출
            const anchors = root.querySelectorAll('a[href*="blog.naver.com"], a[href*="cafe.naver.com"], a[href*="post.naver.com"]');
            
            anchors.forEach((anchor) => {
              const href = (anchor as HTMLAnchorElement).href;
              if (!href || reviewPosts.some((p) => p.url === href)) return;
              
              // 제목 찾기: 가장 가까운 텍스트 요소
              const titleEl = 
                anchor.querySelector('[class*="headline"]') ||
                anchor.querySelector('[class*="title"]') ||
                anchor.querySelector('.tit') ||
                anchor;
              
              const title = (titleEl as HTMLElement).innerText?.trim();
              if (!title || title.length < 2) return;
              
              // 요약 찾기: 형제 또는 부모 요소에서
              const parentItem = anchor.closest('[class*="desktop_mode"]') || anchor.closest('.api_subject_bx');
              const summaryEl = parentItem?.querySelector('[class*="body"]') || 
                               parentItem?.querySelector('[class*="desc"]') ||
                               parentItem?.querySelector('.dsc');
              
              reviewPosts.push({
                rank: null,
                title: title.substring(0, 200),
                url: href,
                summary: summaryEl ? (summaryEl as HTMLElement).innerText.trim().substring(0, 300) : "",
                isPlace: false,
              });
            });
          } catch (e) {}
        });

        if (reviewPosts.length > 0) {
          reviewPosts.forEach((post, idx) => {
            post.rank = idx + 1;
          });
          results.push({
            sectionTitle: "리뷰",
            posts: reviewPosts,
          });
        }
      }

      // 4. 일반 스마트블록 / 뷰 영역 추출
      const boxes = document.querySelectorAll("div.api_subject_bx");

      boxes.forEach((box) => {
        if (
          processedElements.has(box) ||
          box.closest('[data-meta-area="nws_all"]') ||
          box.getAttribute("data-laim-exp-id")?.includes("loc_plc")
        )
          return;

        const headerEl =
          box.querySelector('div[data-template-id="header"] h2') ||
          box.querySelector(".api_title_area h2") ||
          box.querySelector(".tit_chunk");

        const items = box.querySelectorAll(
          'div[data-template-id="ugcItem"], div[data-template-id="webItem"], li.bx'
        );
        const posts: SmartBlockPost[] = [];

        if (headerEl && items.length > 0) {
          const sectionTitle = (headerEl as HTMLElement).innerText.trim();
          if (sectionTitle.includes("뉴스")) return;

          items.forEach((item) => {
            try {
              const titleEl =
                item.querySelector(".sds-comps-text-type-headline1") ||
                item.querySelector(".news_tit") ||
                item.querySelector(".api_txt_lines.tit") ||
                item.querySelector(".total_tit");

              const summaryEl =
                item.querySelector(".sds-comps-text-type-body1") ||
                item.querySelector(".dsc_txt");

              const anchorEl = titleEl ? titleEl.closest("a") : item.querySelector("a");

              if (titleEl && anchorEl && (anchorEl as HTMLAnchorElement).href) {
                const postUrl = (anchorEl as HTMLAnchorElement).href;
                if (!posts.some((p) => p.url === postUrl)) {
                  posts.push({
                    rank: null,
                    title: (titleEl as HTMLElement).innerText.trim(),
                    url: postUrl,
                    summary: summaryEl ? (summaryEl as HTMLElement).innerText.trim() : "",
                    isPlace: false,
                  });
                }
              }
            } catch (e) {}
          });

          if (posts.length > 0) {
            posts.forEach((post, idx) => {
              post.rank = idx + 1;
            });
            results.push({
              sectionTitle: sectionTitle,
              posts: posts,
            });
          }
        }
      });

      // 플레이스 섹션 최상단 고정
      const placeIdx = results.findIndex(
        (s) => s.sectionTitle.includes("플레이스") || s.sectionTitle.includes("지도")
      );
      if (placeIdx > 0) {
        const [placeData] = results.splice(placeIdx, 1);
        results.unshift(placeData);
      }

      return results;
    });

    return sections;
  } catch (error) {
    console.error("Crawling error:", error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function crawlNaverSearch(keyword: string): Promise<SmartBlockSection[]> {
  const cacheKey = keyword.trim().toLowerCase();
  
  const cached = crawlCache.get(cacheKey);
  if (cached) {
    console.log(`[Crawler] Cache hit for keyword: ${keyword}`);
    return cached;
  }
  
  const result = await crawlLimit(() => executeCrawl(keyword));
  
  if (result.length > 0) {
    crawlCache.set(cacheKey, result);
  }
  
  return result;
}
