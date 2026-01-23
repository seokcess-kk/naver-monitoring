import puppeteer, { Browser } from "puppeteer-core";
import { findChromePath } from "./chrome-finder";

const BROWSERLESS_URL = "wss://production-sfo.browserless.io";

export interface BrowserConnection {
  browser: Browser;
  isBrowserless: boolean;
}

/**
 * Browserless 또는 로컬 Chrome에 연결
 * 프로덕션에서는 Browserless 우선, 개발환경에서는 로컬 Chrome 우선
 */
export async function connectBrowser(): Promise<BrowserConnection> {
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
  
  // 프로덕션 환경이거나 BROWSERLESS_API_KEY가 있으면 Browserless 사용
  if (browserlessApiKey) {
    try {
      console.log("[Browserless] Connecting to Browserless cloud...");
      const browser = await puppeteer.connect({
        browserWSEndpoint: `${BROWSERLESS_URL}?token=${browserlessApiKey}`,
      });
      console.log("[Browserless] Connected successfully");
      return { browser, isBrowserless: true };
    } catch (error) {
      console.warn("[Browserless] Failed to connect:", error);
      console.log("[Browserless] Falling back to local Chrome...");
    }
  }
  
  // 로컬 Chrome 사용
  const executablePath = findChromePath();
  if (!executablePath) {
    throw new Error("No Chrome/Chromium found. Set BROWSERLESS_API_KEY for cloud browser.");
  }
  
  console.log("[Chrome] Launching local browser:", executablePath);
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
