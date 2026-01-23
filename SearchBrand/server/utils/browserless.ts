import puppeteer, { Browser } from "puppeteer-core";
import { findChromePath } from "./chrome-finder";

const BROWSERLESS_URL = "wss://production-sfo.browserless.io";

export interface BrowserConnection {
  browser: Browser;
  isBrowserless: boolean;
}

/**
 * 브라우저 연결 (환경별 우선순위)
 * - 프로덕션: Browserless 우선 → 로컬 Chrome fallback
 * - 개발환경: 로컬 Chrome 우선 → Browserless fallback
 */
export async function connectBrowser(): Promise<BrowserConnection> {
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (isProduction) {
    // 프로덕션: Browserless 우선
    if (browserlessApiKey) {
      try {
        console.log("[Browser] Production mode - connecting to Browserless cloud...");
        const browser = await puppeteer.connect({
          browserWSEndpoint: `${BROWSERLESS_URL}?token=${browserlessApiKey}`,
        });
        console.log("[Browser] Browserless connected successfully");
        return { browser, isBrowserless: true };
      } catch (error: any) {
        console.warn("[Browser] Browserless connection failed:", error?.message || error);
        console.log("[Browser] Falling back to local Chrome...");
      }
    } else {
      console.warn("[Browser] BROWSERLESS_API_KEY not set in production - trying local Chrome");
    }
    
    // 프로덕션 fallback: 로컬 Chrome
    return launchLocalChrome();
  } else {
    // 개발환경: 로컬 Chrome 우선
    try {
      console.log("[Browser] Development mode - trying local Chrome first...");
      return await launchLocalChrome();
    } catch (localError: any) {
      console.warn("[Browser] Local Chrome failed:", localError?.message || localError);
      
      // 개발환경 fallback: Browserless
      if (browserlessApiKey) {
        try {
          console.log("[Browser] Falling back to Browserless cloud...");
          const browser = await puppeteer.connect({
            browserWSEndpoint: `${BROWSERLESS_URL}?token=${browserlessApiKey}`,
          });
          console.log("[Browser] Browserless connected successfully");
          return { browser, isBrowserless: true };
        } catch (browserlessError: any) {
          console.error("[Browser] Browserless fallback also failed:", browserlessError?.message || browserlessError);
        }
      }
      
      throw new Error("No browser available. Install Chrome locally or set BROWSERLESS_API_KEY.");
    }
  }
}

async function launchLocalChrome(): Promise<BrowserConnection> {
  const executablePath = findChromePath();
  if (!executablePath) {
    throw new Error("No Chrome/Chromium found locally.");
  }
  
  console.log("[Browser] Launching local Chrome:", executablePath);
  const browser = await puppeteer.launch({
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
  
  console.log("[Browser] Local Chrome launched successfully");
  return { browser, isBrowserless: false };
}

/**
 * 브라우저 연결 해제
 */
export async function disconnectBrowser(connection: BrowserConnection): Promise<void> {
  try {
    if (connection.isBrowserless) {
      await connection.browser.disconnect();
      console.log("[Browserless] Disconnected");
    } else {
      await connection.browser.close();
      console.log("[Chrome] Closed");
    }
  } catch (error) {
    console.warn("[Browser] Error during cleanup:", error);
  }
}
