import puppeteer, { Browser, Page } from "puppeteer";
import pLimit from "p-limit";

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface ScrapedReview {
  text: string;
  date: Date | null;
  author?: string;
  rating?: string;
}

interface ScrapeOptions {
  placeId: string;
  mode: "QTY" | "DATE" | "DATE_RANGE";
  limitQty?: number;
  startDate?: Date;
  endDate?: Date;
  onProgress?: (current: number, total: number) => Promise<void>;
}

const browserLimit = pLimit(2);

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
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

function normalizeToLocalDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isValidDate(date: Date | null): boolean {
  if (!date) return false;
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return date >= fiveYearsAgo && date <= tomorrow;
}

function parseKoreanDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim().length === 0) {
    return null;
  }
  
  const trimmed = dateStr.trim();
  const now = new Date();
  let result: Date | null = null;
  
  if (trimmed === "오늘" || trimmed === "방금") {
    result = normalizeToLocalDate(now);
  } else if (trimmed === "어제") {
    result = normalizeToLocalDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  } else if (trimmed.includes("분 전")) {
    const minutes = parseInt(trimmed.replace(/[^0-9]/g, "")) || 0;
    result = normalizeToLocalDate(new Date(now.getTime() - minutes * 60 * 1000));
  } else if (trimmed.includes("시간 전")) {
    const hours = parseInt(trimmed.replace(/[^0-9]/g, "")) || 0;
    result = normalizeToLocalDate(new Date(now.getTime() - hours * 60 * 60 * 1000));
  } else if (trimmed.includes("일 전")) {
    const days = parseInt(trimmed.replace(/[^0-9]/g, "")) || 0;
    result = normalizeToLocalDate(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  } else if (trimmed.includes("주 전")) {
    const weeks = parseInt(trimmed.replace(/[^0-9]/g, "")) || 0;
    result = normalizeToLocalDate(new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000));
  } else if (trimmed.includes("개월 전")) {
    const months = parseInt(trimmed.replace(/[^0-9]/g, "")) || 0;
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    result = normalizeToLocalDate(date);
  } else if (trimmed.includes("년 전")) {
    const years = parseInt(trimmed.replace(/[^0-9]/g, "")) || 0;
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    result = normalizeToLocalDate(date);
  }

  if (!result) {
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      result = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
  }

  if (!result) {
    const matchYYYY = trimmed.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (matchYYYY) {
      result = new Date(parseInt(matchYYYY[1]), parseInt(matchYYYY[2]) - 1, parseInt(matchYYYY[3]));
    }
  }

  if (!result) {
    const matchKorean = trimmed.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (matchKorean) {
      result = new Date(parseInt(matchKorean[1]), parseInt(matchKorean[2]) - 1, parseInt(matchKorean[3]));
    }
  }

  if (!result) {
    const matchKoreanShort = trimmed.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
    if (matchKoreanShort) {
      result = new Date(now.getFullYear(), parseInt(matchKoreanShort[1]) - 1, parseInt(matchKoreanShort[2]));
    }
  }

  if (!result) {
    const match2 = trimmed.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
    if (match2) {
      result = new Date(now.getFullYear(), parseInt(match2[1]) - 1, parseInt(match2[2]));
    }
  }

  if (result && isValidDate(result)) {
    return result;
  }

  return null;
}

async function extractReviews(page: Page): Promise<ScrapedReview[]> {
  const reviews: ScrapedReview[] = [];

  const reviewData = await page.evaluate(() => {
    const items: Array<{ text: string; date: string; author: string; rating: string }> = [];

    const reviewSelectors = [
      ".pui__vn15t2",
      ".pui__X35jYm",
      ".place_review",
      "[class*='ReviewItem']",
      "[class*='review_item']",
      ".review_content",
    ];

    let reviewElements: Element[] = [];
    for (const selector of reviewSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        reviewElements = Array.from(elements);
        break;
      }
    }

    if (reviewElements.length === 0) {
      const allTextElements = document.querySelectorAll("[class*='review'], [class*='Review']");
      reviewElements = Array.from(allTextElements);
    }

    reviewElements.forEach((el) => {
      const textSelectors = [
        ".pui__xtsQN-",
        ".review_txt",
        "[class*='content']",
        "[class*='text']",
        "p",
        "span",
      ];

      let text = "";
      for (const sel of textSelectors) {
        const textEl = el.querySelector(sel);
        if (textEl && textEl.textContent && textEl.textContent.length > 10) {
          text = textEl.textContent.trim();
          break;
        }
      }
      if (!text && el.textContent) {
        text = el.textContent.trim();
      }

      const dateSelectors = [
        ".pui__gfuUIT time",
        ".pui__blind + span",
        "[class*='time_'] time",
        "[class*='_date']",
        ".review_date",
        "[class*='date']",
        "time",
        "[class*='time']",
        "[class*='ago']",
        "[class*='Date']",
        "[class*='when']",
        "span[class]",
      ];

      let date = "";
      
      for (const sel of dateSelectors) {
        const dateEl = el.querySelector(sel);
        if (dateEl && dateEl.textContent) {
          const txt = dateEl.textContent.trim();
          if (txt === "오늘" || txt === "어제" || txt === "방금") {
            date = txt;
            break;
          }
          if (txt.length < 30 && txt.match(/\d/) && (txt.includes("전") || txt.includes(".") || txt.includes("/") || txt.includes("월") || txt.includes("년"))) {
            date = txt;
            break;
          }
        }
      }
      
      if (!date) {
        const fullText = el.textContent || "";
        const relativeMatch = fullText.match(/(\d+)\s*(분|시간|일|주|개월|년)\s*전/);
        if (relativeMatch) {
          date = relativeMatch[0];
        }
        if (!date) {
          if (fullText.includes("오늘")) date = "오늘";
          else if (fullText.includes("어제")) date = "어제";
          else if (fullText.includes("방금")) date = "방금";
        }
      }
      
      const authorSelectors = [
        ".pui__NMi7ob",
        ".review_writer",
        "[class*='name']",
        "[class*='author']",
        "[class*='user']",
      ];

      let author = "";
      for (const sel of authorSelectors) {
        const authorEl = el.querySelector(sel);
        if (authorEl && authorEl.textContent) {
          author = authorEl.textContent.trim();
          break;
        }
      }

      const ratingEl = el.querySelector("[class*='rating'], [class*='star']");
      const rating = ratingEl?.textContent?.trim() || "";

      if (text.length > 10) {
        items.push({ text, date, author, rating });
      }
    });

    return items;
  });

  console.log(`[PlaceReviewScraper] Extracted ${reviewData.length} raw review items`);
  
  for (const item of reviewData) {
    const parsedDate = parseKoreanDate(item.date);
    
    reviews.push({
      text: item.text.slice(0, 2000),
      date: parsedDate,
      author: item.author || undefined,
      rating: item.rating || undefined,
    });
  }

  console.log(`[PlaceReviewScraper] Reviews with valid dates: ${reviews.filter(r => r.date !== null).length}/${reviews.length}`);
  return reviews;
}

function shouldStopScraping(
  reviews: ScrapedReview[],
  mode: "QTY" | "DATE" | "DATE_RANGE",
  limitQty?: number,
  startDate?: Date,
): boolean {
  if (mode === "QTY" && limitQty && reviews.length >= limitQty) {
    return true;
  }

  if ((mode === "DATE" || mode === "DATE_RANGE") && startDate && reviews.length > 0) {
    const reviewsWithDates = reviews.filter((r) => r.date !== null);
    if (reviewsWithDates.length === 0) {
      return false;
    }
    
    const normalizedStartDate = normalizeToLocalDate(startDate);
    const oldestReview = reviewsWithDates.reduce((oldest, review) =>
      review.date!.getTime() < oldest.date!.getTime() ? review : oldest
    );
    
    if (oldestReview.date!.getTime() < normalizedStartDate.getTime()) {
      return true;
    }
  }

  return false;
}

function filterReviews(
  reviews: ScrapedReview[],
  mode: "QTY" | "DATE" | "DATE_RANGE",
  limitQty?: number,
  startDate?: Date,
  endDate?: Date,
): ScrapedReview[] {
  let filtered = [...reviews];

  if (mode === "DATE" && startDate) {
    const normalizedStartDate = normalizeToLocalDate(startDate);
    const beforeCount = filtered.length;
    
    filtered = filtered.filter((r) => {
      if (r.date === null) return false;
      return r.date.getTime() >= normalizedStartDate.getTime();
    });
    
    console.log(`[PlaceReviewScraper] DATE filter: ${beforeCount} -> ${filtered.length} reviews (startDate=${normalizedStartDate.toISOString().split('T')[0]})`);
  }

  if (mode === "DATE_RANGE" && startDate && endDate) {
    const normalizedStartDate = normalizeToLocalDate(startDate);
    const normalizedEndDate = normalizeToLocalDate(endDate);
    filtered = filtered.filter((r) => {
      if (r.date === null) return false;
      return r.date.getTime() >= normalizedStartDate.getTime() && 
             r.date.getTime() <= normalizedEndDate.getTime();
    });
  }

  if (mode === "QTY" && limitQty) {
    filtered = filtered.slice(0, limitQty);
  }

  return filtered;
}

export async function scrapePlaceReviews(options: ScrapeOptions): Promise<ScrapedReview[]> {
  const { placeId, mode, limitQty, startDate, endDate, onProgress } = options;

  return browserLimit(async () => {
    let browser: Browser | null = null;

    try {
      const reviewUrl = `https://m.place.naver.com/place/${placeId}/review/visitor`;
      console.log(`[PlaceReviewScraper] Starting scrape: ${reviewUrl}`);

      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(MOBILE_USER_AGENT);
      await page.setViewport({ width: 412, height: 915 });

      await page.goto(reviewUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const allReviews: ScrapedReview[] = [];
      const seenTexts = new Set<string>();
      let stableCount = 0;
      let previousCount = 0;
      const maxScrolls = 50;

      for (let scrollIdx = 0; scrollIdx < maxScrolls; scrollIdx++) {
        const pageReviews = await extractReviews(page);

        for (const review of pageReviews) {
          const key = review.text.slice(0, 100);
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            allReviews.push(review);
          }
        }

        if (onProgress) {
          const estimatedTotal = mode === "QTY" && limitQty ? limitQty : allReviews.length + 10;
          await onProgress(allReviews.length, estimatedTotal);
        }

        if (shouldStopScraping(allReviews, mode, limitQty, startDate)) {
          console.log(`[PlaceReviewScraper] Stop condition met at scroll ${scrollIdx}`);
          break;
        }

        if (allReviews.length === previousCount) {
          stableCount++;
        } else {
          stableCount = 0;
        }

        if (stableCount >= 3) {
          console.log(`[PlaceReviewScraper] No new reviews found, stopping`);
          break;
        }

        previousCount = allReviews.length;

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const moreButtonClicked = await page.evaluate(() => {
          const moreSelectors = [
            "a.fvwqf",
            "a[class*='more']",
            "button[class*='more']",
            "[class*='더보기']",
          ];

          for (const selector of moreSelectors) {
            const btn = document.querySelector(selector) as HTMLElement;
            if (btn && btn.offsetParent !== null) {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (moreButtonClicked) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const filteredReviews = filterReviews(allReviews, mode, limitQty, startDate, endDate);
      console.log(`[PlaceReviewScraper] Scraped ${filteredReviews.length} reviews (filtered from ${allReviews.length})`);

      return filteredReviews;
    } catch (error) {
      console.error("[PlaceReviewScraper] Scraping failed:", error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
}
