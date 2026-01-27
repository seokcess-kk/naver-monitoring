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

export type DeviceMode = "pc" | "mobile";

const crawlLimit = pLimit(2);

const crawlCache = new LRUCache<string, SmartBlockSection[]>({
  max: 200,
  ttl: 3 * 60 * 1000,
});

const DEVICE_CONFIGS = {
  pc: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 1080 },
    url: (keyword: string) => `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`,
  },
  mobile: {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    url: (keyword: string) => `https://m.search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`,
  },
};

async function executeCrawl(keyword: string, device: DeviceMode = "pc"): Promise<SmartBlockSection[]> {
  let connection: BrowserConnection | null = null;
  const config = DEVICE_CONFIGS[device];

  try {
    connection = await connectBrowser();

    const page = await connection.browser.newPage();
    await page.setViewport(config.viewport);
    await page.setUserAgent(config.userAgent);

    const url = config.url(keyword);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const sections = await page.evaluate((isMobile: boolean) => {
      const results: SmartBlockSection[] = [];
      const processedElements = new Set<Element>();

      // 1. 플레이스(지도) 영역 추출 - PC와 모바일 셀렉터 모두 지원
      const placePosts: SmartBlockPost[] = [];
      
      if (isMobile) {
        // 모바일: PC와 동일한 셀렉터 사용 (모바일도 PC 버전과 유사한 구조 사용)
        // m.search.naver.com도 실제로는 PC와 비슷한 DOM 구조를 가짐
        const mobileSelectors = [
          '#loc-main-section-root',
          '#place-main-section-root', 
          '[data-laim-exp-id*="loc_plc"]',
          '[data-laim-exp-id*="nmb_hpl"]',
          '.api_subject_bx[data-template-type="place"]',
          '[data-template-type="place"]',
          '.place_section',
        ];

        let placeSection: Element | null = null;
        for (const sel of mobileSelectors) {
          placeSection = document.querySelector(sel);
          if (placeSection) break;
        }

        if (placeSection) {
          processedElements.add(placeSection);
          const listItems = placeSection.querySelectorAll('li');
          
          let rankCounter = 1;
          listItems.forEach((li) => {
            try {
              // data 속성에서 플레이스 ID 추출
              const docId =
                li.getAttribute("data-loc_plce-doc-id") ||
                li.getAttribute("data-loc_plc-doc-id") ||
                li.getAttribute("data-nmb_hpl-doc-id") ||
                li.getAttribute("data-doc-id") ||
                "";

              // 광고 제외
              if (
                docId.includes("nad") ||
                li.classList.contains("type_ad") ||
                li.getAttribute("data-nclk")?.includes("ads")
              )
                return;

              // 이름 추출 - 다양한 셀렉터 시도
              const nameEl =
                li.querySelector(".YwYLL") ||
                li.querySelector(".q2LdB") ||
                li.querySelector(".tit_place") ||
                li.querySelector(".place_bluelink") ||
                li.querySelector(".place_name") ||
                li.querySelector(".name") ||
                li.querySelector("a");

              // 링크 추출
              const linkEl =
                li.querySelector("a.place_bluelink") ||
                li.querySelector('a[href*="map.naver.com"]') ||
                li.querySelector('a[href*="place.naver.com"]') ||
                li.querySelector("a");

              if (nameEl) {
                const title = (nameEl as HTMLElement).innerText?.trim() || '';
                let url = linkEl ? (linkEl as HTMLAnchorElement).href?.split("?")[0] : "#";
                
                // href가 없으면 data 속성에서 placeId로 URL 생성
                if ((!url || url === '#') && docId) {
                  url = `https://m.place.naver.com/place/${docId}`;
                }
                
                if (title && title.length > 0 && !placePosts.some(p => p.title === title)) {
                  placePosts.push({
                    rank: rankCounter++,
                    title,
                    url,
                    summary: "네이버 플레이스",
                    isPlace: true,
                  });
                }
              }
            } catch (e) {}
          });
        }

        // 추가: 플레이스 링크 직접 탐색 (섹션을 못 찾은 경우)
        if (placePosts.length === 0) {
          const allPlaceLinks = document.querySelectorAll(
            'a[href*="place.naver.com"], a[href*="map.naver.com/place"]'
          );
          
          let rankCounter = 1;
          allPlaceLinks.forEach((anchor) => {
            try {
              const href = (anchor as HTMLAnchorElement).href;
              if (!href || href.includes('nad')) return;
              
              // 가장 가까운 컨테이너에서 이름 찾기
              const container = anchor.closest('li') || anchor.closest('div');
              const nameEl = container?.querySelector('.place_name, .name, [class*="name"]') || anchor;
              const title = (nameEl as HTMLElement)?.innerText?.trim() || '';
              
              if (title && title.length > 1 && !placePosts.some(p => p.url === href.split('?')[0])) {
                placePosts.push({
                  rank: rankCounter++,
                  title,
                  url: href.split('?')[0],
                  summary: "네이버 플레이스",
                  isPlace: true,
                });
              }
            } catch (e) {}
          });
        }
      } else {
        // PC용 기존 로직
        const placeSection =
          document.querySelector("#loc-main-section-root") ||
          document.querySelector("#place-main-section-root") ||
          document.querySelector('[data-laim-exp-id*="loc_plc"]') ||
          document.querySelector('[data-laim-exp-id*="nmb_hpl"]') ||
          document.querySelector('.api_subject_bx[data-template-type="place"]');

        if (placeSection) {
          processedElements.add(placeSection);
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
                li.querySelector('a[href*="place.naver.com"]') ||
                li.querySelector("a");

              if (nameEl) {
                const title = (nameEl as HTMLElement).innerText.trim();
                if (title && title.length > 0) {
                  placePosts.push({
                    rank: rankCounter++,
                    title,
                    url: linkEl ? (linkEl as HTMLAnchorElement).href.split("?")[0] : "#",
                    summary: "네이버 플레이스",
                    isPlace: true,
                  });
                }
              }
            } catch (e) {}
          });
        }
      }

      if (placePosts.length > 0) {
        results.push({
          sectionTitle: "플레이스 (지도)",
          posts: placePosts,
        });
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
        // 인플루언서 블록: sdsFeedSearchHeader 내 span.sds-comps-text-type-headline1
        const headerEl =
          box.querySelector('[data-template-id*="Header"] h2') ||
          box.querySelector('[data-template-id*="Header"] span.sds-comps-text-type-headline1') ||
          box.querySelector('[data-template-id*="Header"] .sds-comps-text-type-headline1') ||
          box.querySelector('div[data-template-id="header"] h2') ||
          box.querySelector(".api_title_area h2") ||
          box.querySelector(".tit_chunk") ||
          box.querySelector(".sds-comps-header h2") ||
          box.querySelector(".sds-comps-header .sds-comps-text-type-headline1") ||
          box.querySelector(".fds-ugc-influencer .sds-comps-text-type-headline1");

        if (!headerEl) return;
        
        const sectionTitle = (headerEl as HTMLElement).innerText.trim();
        if (sectionTitle.includes("뉴스")) return;

        // fds-ugc-item-list 컨테이너 존재 여부 확인 (인플루언서/UGC 블록)
        const hasUgcItemList = box.querySelector(".fds-ugc-item-list") !== null;
        
        // 1. UGC 아이템 리스트 우선 탐색 (인플루언서 블록 등)
        let items: NodeListOf<Element>;
        if (hasUgcItemList) {
          items = box.querySelectorAll('.fds-ugc-item-list > [data-template-id]');
        } else {
          // 2. 기존 방식: 템플릿 기반 아이템 추출
          items = box.querySelectorAll(
            'div[data-template-id="ugcItem"], div[data-template-id="ugcItemDesk"], div[data-template-id="ugcItemMo"], div[data-template-id="webItem"], li.bx'
          );
        }
        
        // 3. 대안 방식: 반복 아이템 컨테이너 탐색
        if (items.length === 0) {
          items = box.querySelectorAll(
            '[data-template-id*="Item"]:not([data-template-id="sdsVerticalLayout"]):not([data-template-id*="Layout"])'
          );
        }
        
        // 디버깅: 인플루언서/UGC 블록 감지 로그
        if (hasUgcItemList) {
          console.log(`[SmartBlock] UGC item-list detected: "${sectionTitle}", items found: ${items.length}`);
          if (items.length === 0) {
            console.log(`[SmartBlock] WARNING: UGC block "${sectionTitle}" has no items. DOM structure may differ.`);
          }
        }
        
        const posts: SmartBlockPost[] = [];
        const seenUrls = new Set<string>();
        let debugItemCount = 0;

        items.forEach((item) => {
          debugItemCount++;
          try {
            // 제목 요소 탐색 (확장된 셀렉터)
            let titleEl: Element | null = null;
            let titleSource = "";
            
            // 1. 인플루언서/UGC 블록: data-heatmap-target=".link" 내부 텍스트 (가장 신뢰성 높음)
            const heatmapLink = item.querySelector('a[data-heatmap-target=".link"]');
            if (heatmapLink) {
              titleEl = heatmapLink.querySelector(".fds-comps-text, .ellipsis2, span") || heatmapLink;
              if (titleEl) titleSource = "heatmap-link";
            }
            
            // 2. profile 외부의 ellipsis2 클래스 요소
            if (!titleEl) {
              const ellipsis2Els = Array.from(item.querySelectorAll(".ellipsis2, .fds-comps-text.ellipsis2"));
              for (const el of ellipsis2Els) {
                if (!el.closest(".profile-group") && !el.closest(".sds-comps-profile")) {
                  titleEl = el;
                  if (!titleSource) titleSource = "ellipsis2";
                  break;
                }
              }
            }
            
            // 3. 일반 스마트블록 셀렉터
            if (!titleEl) {
              titleEl =
                item.querySelector(".sds-comps-text-type-headline1") ||
                item.querySelector(".news_tit") ||
                item.querySelector(".api_txt_lines.tit") ||
                item.querySelector(".total_tit") ||
                item.querySelector('h3');
              if (titleEl && !titleSource) titleSource = "general";
            }
            
            // 4. 기타 fallback: [class*="title"] 중 profile 영역 제외
            if (!titleEl) {
              const titleCandidates = Array.from(item.querySelectorAll('[class*="title"]'));
              for (const el of titleCandidates) {
                if (!el.closest(".profile-group") && !el.closest(".sds-comps-profile") && !el.classList.contains("sds-comps-profile-info-title-text")) {
                  titleEl = el;
                  if (!titleSource) titleSource = "fallback";
                  break;
                }
              }
            }
            
            // UGC 블록 디버깅: 제목 추출 실패 로그
            if (hasUgcItemList && !titleEl) {
              console.log(`[SmartBlock] UGC item #${debugItemCount}: No title found`);
            }

            // 설명 요소 탐색
            let summaryEl =
              item.querySelector(".sds-comps-text-type-body1") ||
              item.querySelector(".dsc_txt") ||
              item.querySelector('[class*="desc"]');
            
            // UGC/인플루언서 블록 설명: ellipsis2 없는 .fds-comps-text (profile 외부)
            if (!summaryEl) {
              const fdsTexts = Array.from(item.querySelectorAll(".fds-comps-text"));
              for (const el of fdsTexts) {
                if (!el.classList.contains("ellipsis2") && !el.closest(".profile-group") && !el.closest(".sds-comps-profile")) {
                  summaryEl = el;
                  break;
                }
              }
            }

            // 대표 링크 탐색: 제목에서 추출 우선, heatmap 링크, 첫 번째 콘텐츠 링크
            let anchorEl: HTMLAnchorElement | null = titleEl ? titleEl.closest("a") : null;
            if (!anchorEl && heatmapLink) {
              anchorEl = heatmapLink as HTMLAnchorElement;
            }
            if (!anchorEl) {
              // profile 영역 외부의 첫 번째 유효 링크
              const allAnchors = Array.from(item.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
              for (const a of allAnchors) {
                if (!a.closest(".profile-group") && !a.closest(".sds-comps-profile")) {
                  anchorEl = a;
                  break;
                }
              }
            }
            
            // UGC 블록 디버깅: 앵커 추출 실패 로그
            if (hasUgcItemList && !anchorEl) {
              console.log(`[SmartBlock] UGC item #${debugItemCount}: No anchor found (titleEl: ${!!titleEl})`);
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
                
                // UGC 블록 디버깅: 성공 로그 (첫 번째 아이템만)
                if (hasUgcItemList && posts.length === 1) {
                  console.log(`[SmartBlock] UGC post extracted: "${title.substring(0, 30)}..." (source: ${titleSource})`);
                }
              } else if (hasUgcItemList) {
                console.log(`[SmartBlock] UGC item #${debugItemCount}: Title too short: "${title}"`);
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
    }, device === "mobile");

    return sections as SmartBlockSection[];
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

export async function crawlNaverSearch(keyword: string, device: DeviceMode = "pc"): Promise<SmartBlockSection[]> {
  const cacheKey = `${device}:${keyword.trim().toLowerCase()}`;
  
  const cached = crawlCache.get(cacheKey);
  if (cached) {
    console.log(`[Crawler] Cache hit for keyword: ${keyword} (${device})`);
    return cached;
  }
  
  const result = await crawlLimit(() => executeCrawl(keyword, device));
  
  if (result.length > 0) {
    crawlCache.set(cacheKey, result);
  }
  
  return result;
}

export interface SmartBlockComparison {
  pc: SmartBlockSection[];
  mobile: SmartBlockSection[];
  differences: {
    pcOnly: number;
    mobileOnly: number;
    rankDifferences: number;
  };
}

export async function crawlNaverSearchBoth(keyword: string): Promise<SmartBlockComparison> {
  const [pc, mobile] = await Promise.all([
    crawlNaverSearch(keyword, "pc"),
    crawlNaverSearch(keyword, "mobile"),
  ]);

  let pcOnly = 0;
  let mobileOnly = 0;
  let rankDifferences = 0;

  // 섹션 타이틀별로 그룹화
  const pcSectionMap = new Map<string, SmartBlockSection>();
  const mobileSectionMap = new Map<string, SmartBlockSection>();

  pc.forEach(section => pcSectionMap.set(section.sectionTitle, section));
  mobile.forEach(section => mobileSectionMap.set(section.sectionTitle, section));

  // 공통 섹션에서만 차이점 계산 (같은 섹션끼리 비교)
  const allSectionTitles = new Set([...Array.from(pcSectionMap.keys()), ...Array.from(mobileSectionMap.keys())]);

  allSectionTitles.forEach(sectionTitle => {
    const pcSection = pcSectionMap.get(sectionTitle);
    const mobileSection = mobileSectionMap.get(sectionTitle);

    if (!pcSection && mobileSection) {
      // 모바일에만 있는 섹션은 차이로 카운트하지 않음 (구조 차이)
      return;
    }
    if (pcSection && !mobileSection) {
      // PC에만 있는 섹션은 차이로 카운트하지 않음 (구조 차이)
      return;
    }

    if (pcSection && mobileSection) {
      // 같은 섹션 내에서 URL 비교
      const pcUrls = new Set(pcSection.posts.map(p => p.url));
      const mobileUrls = new Set(mobileSection.posts.map(p => p.url));

      // PC에만 있는 항목
      pcSection.posts.forEach(post => {
        if (!mobileUrls.has(post.url)) pcOnly++;
      });

      // 모바일에만 있는 항목
      mobileSection.posts.forEach(post => {
        if (!pcUrls.has(post.url)) mobileOnly++;
      });

      // 순위 차이 (둘 다 있는 항목)
      const pcRankMap = new Map<string, number>();
      pcSection.posts.forEach(post => {
        if (post.rank) pcRankMap.set(post.url, post.rank);
      });

      mobileSection.posts.forEach(post => {
        if (post.rank && pcRankMap.has(post.url)) {
          const pcRank = pcRankMap.get(post.url)!;
          if (Math.abs(pcRank - post.rank) >= 2) {
            rankDifferences++;
          }
        }
      });
    }
  });

  return {
    pc,
    mobile,
    differences: {
      pcOnly,
      mobileOnly,
      rankDifferences,
    },
  };
}
