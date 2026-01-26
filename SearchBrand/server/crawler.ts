import pLimit from "p-limit";
import LRUCache from "lru-cache";
import { connectBrowser, disconnectBrowser, BrowserConnection } from "./utils/browserless";

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

async function executeCrawl(keyword: string): Promise<SmartBlockSection[]> {
  let connection: BrowserConnection | null = null;

  try {
    connection = await connectBrowser();

    const page = await connection.browser.newPage();
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

      // 3. 리뷰/웹 영역 추출 (Fender 렌더링 구조)
      // review 섹션 및 웹 검색 결과 블록 모두 수집
      const reviewSections = document.querySelectorAll(
        '[data-meta-ssuid="review"], [data-block-id*="review/"], [data-meta-ssuid="web"][data-block-id*="web/"], [data-meta-area="urB_boR"]'
      );

      if (reviewSections.length > 0) {
        const reviewPosts: SmartBlockPost[] = [];
        
        reviewSections.forEach((section) => {
          const parentBox = section.closest(".spw_fsolid") || section.closest(".api_subject_bx");
          if (parentBox) processedElements.add(parentBox);
          processedElements.add(section);

          // Fender 구조 내부 아이템 추출 (웹 블록용 셀렉터 추가)
          const items = section.querySelectorAll(
            '.api_subject_bx, [class*="desktop_mode"], .fds-web-doc-root, [data-template-id="layout"]'
          );

          items.forEach((item) => {
            try {
              // 다양한 제목 셀렉터 시도
              const titleEl =
                item.querySelector('a[class*="title"]') ||
                item.querySelector('[class*="headline"]') ||
                item.querySelector('.tit') ||
                item.querySelector('a');

              const summaryEl =
                item.querySelector('[class*="body"]') ||
                item.querySelector('[class*="desc"]') ||
                item.querySelector('.dsc');

              const anchorEl = titleEl?.tagName === "A" 
                ? titleEl 
                : titleEl?.closest("a") || item.querySelector("a");

              if (anchorEl && (anchorEl as HTMLAnchorElement).href) {
                const href = (anchorEl as HTMLAnchorElement).href;
                // 네이버 내부 검색 링크 제외 (실제 콘텐츠 링크만 수집)
                const isInternalSearch = 
                  href.includes("search.naver.com") || 
                  href.includes("naver.com/search");
                  
                if (!isInternalSearch && href.startsWith("http")) {
                  const title = titleEl 
                    ? (titleEl as HTMLElement).innerText.trim() 
                    : (anchorEl as HTMLElement).innerText.trim();
                  
                  if (title && !reviewPosts.some((p) => p.url === href)) {
                    reviewPosts.push({
                      rank: null,
                      title: title.substring(0, 200),
                      url: href,
                      summary: summaryEl ? (summaryEl as HTMLElement).innerText.trim().substring(0, 300) : "",
                      isPlace: false,
                    });
                  }
                }
              }
            } catch (e) {}
          });
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
      // classList의 마지막 항목이 api_subject_bx인 요소만 필터링
      const boxes = Array.from(document.querySelectorAll("div.api_subject_bx"))
        .filter((el) => {
          const classList = Array.from(el.classList);
          return classList[classList.length - 1] === "api_subject_bx";
        });

      boxes.forEach((box) => {
        if (
          processedElements.has(box) ||
          box.closest('[data-meta-area="nws_all"]') ||
          box.getAttribute("data-laim-exp-id")?.includes("loc_plc")
        )
          return;

        // 헤더 추출 (헤더 컨테이너 내에서만)
        const headerEl =
          box.querySelector('[data-template-id*="Header"] h2') ||
          box.querySelector('[data-template-id*="Header"] .sds-comps-text-type-headline1') ||
          box.querySelector('div[data-template-id="header"] h2') ||
          box.querySelector(".api_title_area h2") ||
          box.querySelector(".tit_chunk") ||
          box.querySelector(".sds-comps-header h2") ||
          box.querySelector(".sds-comps-header .sds-comps-text-type-headline1");

        if (!headerEl) return;
        
        const sectionTitle = (headerEl as HTMLElement).innerText.trim();
        if (sectionTitle.includes("뉴스")) return;

        // 1. 기존 방식: 템플릿 기반 아이템 추출 시도
        let items = box.querySelectorAll(
          'div[data-template-id="ugcItem"], div[data-template-id="ugcItemDesk"], div[data-template-id="webItem"], li.bx'
        );
        
        // 2. 대안 방식: 반복 아이템 컨테이너 탐색 (인플루언서 블록 등)
        if (items.length === 0) {
          items = box.querySelectorAll(
            '.fds-ugc-item-list > [data-template-id], [data-template-id*="Item"], .sds-comps-vertical-layout > [data-template-id]'
          );
        }
        
        const posts: SmartBlockPost[] = [];
        const seenUrls = new Set<string>();

        items.forEach((item) => {
          try {
            // 제목 요소 탐색 (확장된 셀렉터)
            const titleEl =
              item.querySelector(".sds-comps-text-type-headline1") ||
              item.querySelector(".news_tit") ||
              item.querySelector(".api_txt_lines.tit") ||
              item.querySelector(".total_tit") ||
              item.querySelector('[class*="title"]') ||
              item.querySelector('h3');

            const summaryEl =
              item.querySelector(".sds-comps-text-type-body1") ||
              item.querySelector(".dsc_txt") ||
              item.querySelector('[class*="desc"]');

            // 대표 링크 탐색: 제목 링크 우선, 없으면 첫 번째 콘텐츠 링크
            let anchorEl = titleEl ? titleEl.closest("a") : null;
            if (!anchorEl) {
              anchorEl = item.querySelector('a[href^="http"]');
            }

            if (anchorEl && (anchorEl as HTMLAnchorElement).href) {
              const postUrl = (anchorEl as HTMLAnchorElement).href;
              
              // 중복 URL 제거
              if (seenUrls.has(postUrl)) return;
              seenUrls.add(postUrl);
              
              // 제목 추출
              let title = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';
              if (!title || title.length < 3) {
                title = (anchorEl as HTMLAnchorElement).textContent?.trim() || '';
              }
              if (!title || title.length < 3) {
                title = (anchorEl as HTMLAnchorElement).getAttribute('title') || '';
              }
              
              if (title && title.length >= 3) {
                posts.push({
                  rank: null,
                  title: title,
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
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('Browser was not found') || 
        errorMessage.includes('executablePath') ||
        errorMessage.includes('No browser available') ||
        errorMessage.includes('No Chrome/Chromium')) {
      console.error("[Crawler] Browser unavailable. SmartBlock crawling disabled.");
      console.error("[Crawler] Solutions: 1) Install Chrome locally, or 2) Set BROWSERLESS_API_KEY for cloud browser");
    } else {
      console.error("[Crawler] Crawling error:", errorMessage);
    }
    return [];
  } finally {
    if (connection) {
      await disconnectBrowser(connection);
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
