import puppeteer, { Browser, Page } from "puppeteer";
import pLimit from "p-limit";

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface ScrapedReview {
  text: string;
  date: Date;
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

function parseKoreanDate(dateStr: string): Date {
  const now = new Date();
  
  if (dateStr.includes("분 전")) {
    const minutes = parseInt(dateStr.replace(/[^0-9]/g, "")) || 0;
    return new Date(now.getTime() - minutes * 60 * 1000);
  }
  if (dateStr.includes("시간 전")) {
    const hours = parseInt(dateStr.replace(/[^0-9]/g, "")) || 0;
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }
  if (dateStr.includes("일 전")) {
    const days = parseInt(dateStr.replace(/[^0-9]/g, "")) || 0;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  if (dateStr.includes("주 전")) {
    const weeks = parseInt(dateStr.replace(/[^0-9]/g, "")) || 0;
    return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  }
  if (dateStr.includes("개월 전")) {
    const months = parseInt(dateStr.replace(/[^0-9]/g, "")) || 0;
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  }
  if (dateStr.includes("년 전")) {
    const years = parseInt(dateStr.replace(/[^0-9]/g, "")) || 0;
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date;
  }

  const match = dateStr.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  const match2 = dateStr.match(/(\d{1,2})[.\-\/](\d{1,2})/);
  if (match2) {
    return new Date(now.getFullYear(), parseInt(match2[1]) - 1, parseInt(match2[2]));
  }

  return now;
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
        ".review_date",
        "[class*='date']",
        "time",
        "[class*='time']",
      ];

      let date = "";
      for (const sel of dateSelectors) {
        const dateEl = el.querySelector(sel);
        if (dateEl && dateEl.textContent) {
          date = dateEl.textContent.trim();
          break;
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

  for (const item of reviewData) {
    reviews.push({
      text: item.text.slice(0, 2000),
      date: parseKoreanDate(item.date),
      author: item.author || undefined,
      rating: item.rating || undefined,
    });
  }

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
    const oldestReview = reviews.reduce((oldest, review) =>
      review.date < oldest.date ? review : oldest
    );
    if (oldestReview.date < startDate) {
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
    filtered = filtered.filter((r) => r.date >= startDate);
  }

  if (mode === "DATE_RANGE" && startDate && endDate) {
    filtered = filtered.filter((r) => r.date >= startDate && r.date <= endDate);
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
