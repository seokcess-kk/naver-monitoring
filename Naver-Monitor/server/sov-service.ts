import OpenAI from "openai";
import axios from "axios";
import { db } from "./db";
import {
  sovRuns,
  sovExposures,
  sovScores,
  sovResults,
  sovResultsByType,
  type SovRun,
  type SovExposure,
  type SovResultByType,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { crawlNaverSearch } from "./crawler";
import puppeteer from "puppeteer";
import pLimit from "p-limit";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RELEVANCE_THRESHOLD = 0.72;
const RULE_WEIGHT = 0.4;
const SEMANTIC_WEIGHT = 0.6;

const contentExtractionLimit = pLimit(2);

interface FlatSmartBlockItem {
  blockType: string;
  title: string;
  url: string;
  description: string;
}

async function extractContentWithHttp(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      maxRedirects: 5,
    });

    if (response.status >= 400) {
      return null;
    }

    const html = response.data as string;
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (textContent.length < 500) {
      return null;
    }

    return textContent.slice(0, 5000);
  } catch (error) {
    const axiosError = error as any;
    if (axiosError?.response?.status === 403 || 
        axiosError?.response?.status === 429 || 
        axiosError?.response?.status >= 500) {
      return null;
    }
    return null;
  }
}

function getUrlType(url: string): "blog" | "view" | "news" | "other" {
  if (url.includes("blog.naver.com")) {
    return "blog";
  }
  if (url.includes("in.naver.com") || url.includes("post.naver.com")) {
    return "view";
  }
  if (url.includes("news.naver.com") || url.includes("n.news.naver.com")) {
    return "news";
  }
  return "other";
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
          
          if (pathParts.length >= 1 && !blogId) {
            blogId = pathParts[0];
          }
          
          if (pathParts.length >= 2 && /^\d+$/.test(pathParts[1]) && !logNo) {
            logNo = pathParts[1];
          }
        }
      }
      
      if (blogId && logNo) {
        console.log(`[SOV] Converted blog URL: blogId=${blogId}, logNo=${logNo}`);
        return `https://m.blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
      }
      
      if (blogId) {
        return `https://m.blog.naver.com/${blogId}`;
      }
    }
    
    return url;
  } catch (error) {
    console.error("[SOV] Blog URL conversion error:", error);
    return url;
  }
}

async function extractBlogContent(url: string): Promise<string | null> {
  let browser = null;
  try {
    const mobileUrl = convertBlogUrlToMobile(url);
    console.log(`[SOV] Extracting blog content from: ${mobileUrl}`);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    );
    
    await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector(".se-main-container, .post-view, .se_component_wrap, #postViewArea, .post_ct", { timeout: 10000 }).catch(() => {});

    const textContent = await page.evaluate(() => {
      const selectors = [
        ".se-main-container",
        ".post-view",
        ".se_component_wrap", 
        "#postViewArea",
        ".post_ct",
        ".se_textarea",
        "article",
        ".post-body"
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 100) {
          return el.textContent.trim();
        }
      }
      
      const scripts = document.querySelectorAll("script, style, noscript, header, nav, footer");
      scripts.forEach((el) => el.remove());
      return document.body?.innerText || "";
    });

    const cleaned = textContent.replace(/\s+/g, " ").trim();
    console.log(`[SOV] Blog content extracted: ${cleaned.length} chars`);
    return cleaned.length > 100 ? cleaned.slice(0, 5000) : null;
  } catch (error) {
    console.error("[SOV] Blog extraction failed:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function extractViewContent(url: string): Promise<string | null> {
  let browser = null;
  try {
    console.log(`[SOV] Extracting VIEW content from: ${url}`);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    );
    
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector(".se-main-container, .post_ct, article, .content_view", { timeout: 10000 }).catch(() => {});

    const textContent = await page.evaluate(() => {
      const selectors = [
        ".se-main-container",
        ".post_ct",
        ".content_view",
        "article",
        ".post-body",
        ".se_component_wrap"
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 100) {
          return el.textContent.trim();
        }
      }
      
      const scripts = document.querySelectorAll("script, style, noscript, header, nav, footer");
      scripts.forEach((el) => el.remove());
      return document.body?.innerText || "";
    });

    const cleaned = textContent.replace(/\s+/g, " ").trim();
    console.log(`[SOV] VIEW content extracted: ${cleaned.length} chars`);
    return cleaned.length > 100 ? cleaned.slice(0, 5000) : null;
  } catch (error) {
    console.error("[SOV] VIEW extraction failed:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function extractContentWithPuppeteer(url: string): Promise<string | null> {
  let browser = null;
  try {
    console.log(`[SOV] Extracting content with Puppeteer from: ${url}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    const textContent = await page.evaluate(() => {
      const articleSelectors = [
        "article",
        ".article_body",
        ".news_end",
        "#articleBodyContents",
        ".newsct_article",
        "#dic_area",
        ".content"
      ];
      
      for (const selector of articleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 100) {
          return el.textContent.trim();
        }
      }
      
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());
      return document.body?.innerText || "";
    });

    const cleaned = textContent.replace(/\s+/g, " ").trim();
    console.log(`[SOV] Puppeteer content extracted: ${cleaned.length} chars`);
    return cleaned.length > 100 ? cleaned.slice(0, 5000) : null;
  } catch (error) {
    console.error("[SOV] Puppeteer extraction failed:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function extractContent(url: string): Promise<{ content: string | null; status: string; urlType: string }> {
  const urlType = getUrlType(url);
  console.log(`[SOV] Extracting content for URL type: ${urlType}, URL: ${url}`);
  
  try {
    if (urlType === "blog") {
      const blogContent = await withTimeout(extractBlogContent(url), 35000, null);
      if (blogContent) {
        return { content: blogContent, status: "success", urlType };
      }
      console.log(`[SOV] Blog extraction failed for: ${url}`);
      return { content: null, status: "failed", urlType };
    }

    if (urlType === "view") {
      const viewContent = await withTimeout(extractViewContent(url), 35000, null);
      if (viewContent) {
        return { content: viewContent, status: "success", urlType };
      }
      console.log(`[SOV] VIEW extraction failed for: ${url}`);
      return { content: null, status: "failed", urlType };
    }

    const httpContent = await withTimeout(extractContentWithHttp(url), 15000, null);
    if (httpContent) {
      return { content: httpContent, status: "success", urlType };
    }

    const puppeteerContent = await withTimeout(extractContentWithPuppeteer(url), 30000, null);
    if (puppeteerContent) {
      return { content: puppeteerContent, status: "success", urlType };
    }

    console.log(`[SOV] Content extraction failed for: ${url}`);
    return { content: null, status: "failed", urlType };
  } catch (error) {
    console.error("[SOV] Content extraction error:", error);
    return { content: null, status: "failed", urlType };
  }
}

async function getEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.slice(0, 8000);
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: truncatedText,
  });

  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateRuleScore(content: string, brand: string): number {
  const lowerContent = content.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  
  const brandWords = lowerBrand.split(/\s+/);
  let matchCount = 0;
  
  for (const word of brandWords) {
    if (word.length >= 2 && lowerContent.includes(word)) {
      matchCount++;
    }
  }

  const exactMatch = lowerContent.includes(lowerBrand);
  const partialRatio = brandWords.length > 0 ? matchCount / brandWords.length : 0;

  if (exactMatch) {
    return Math.min(1, 0.8 + partialRatio * 0.2);
  }

  return partialRatio * 0.6;
}

async function calculateSemanticScore(
  contentEmbedding: number[],
  brandEmbedding: number[]
): Promise<number> {
  return cosineSimilarity(contentEmbedding, brandEmbedding);
}

function calculateCombinedScore(ruleScore: number, semanticScore: number): number {
  return RULE_WEIGHT * ruleScore + SEMANTIC_WEIGHT * semanticScore;
}

export async function createSovRun(
  userId: string,
  marketKeyword: string,
  brands: string[]
): Promise<SovRun> {
  const [run] = await db
    .insert(sovRuns)
    .values({
      userId,
      marketKeyword,
      brands,
    })
    .returning();

  return run;
}

export async function getSovRun(runId: string): Promise<SovRun | undefined> {
  const [run] = await db.select().from(sovRuns).where(eq(sovRuns.id, runId));
  return run;
}

export async function getSovRunsByUser(userId: string): Promise<SovRun[]> {
  return db.select().from(sovRuns).where(eq(sovRuns.userId, userId));
}

export async function getSovExposuresByRun(runId: string): Promise<SovExposure[]> {
  return db.select().from(sovExposures).where(eq(sovExposures.runId, runId));
}

export async function getSovResultsByRun(runId: string) {
  return db.select().from(sovResults).where(eq(sovResults.runId, runId));
}

export async function getSovResultsByTypeForRun(runId: string): Promise<SovResultByType[]> {
  return db.select().from(sovResultsByType).where(eq(sovResultsByType.runId, runId));
}

async function updateRunStatus(
  runId: string,
  status: string,
  totalExposures?: number,
  processedExposures?: number,
  errorMessage?: string
) {
  const updates: any = { status };
  if (totalExposures !== undefined) updates.totalExposures = String(totalExposures);
  if (processedExposures !== undefined) updates.processedExposures = String(processedExposures);
  if (errorMessage !== undefined) updates.errorMessage = errorMessage;
  if (status === "completed" || status === "failed") {
    updates.completedAt = new Date();
  }

  await db.update(sovRuns).set(updates).where(eq(sovRuns.id, runId));
}

export async function executeSovRun(runId: string): Promise<void> {
  try {
    const run = await getSovRun(runId);
    if (!run) {
      throw new Error("Run not found");
    }

    await updateRunStatus(runId, "crawling");

    const smartBlockSections = await crawlNaverSearch(run.marketKeyword);
    
    console.log(`[SOV] Crawled ${smartBlockSections.length} sections for keyword: ${run.marketKeyword}`);
    for (const section of smartBlockSections) {
      console.log(`[SOV] Section: "${section.sectionTitle}" with ${section.posts.length} posts`);
    }
    
    const flatItems: FlatSmartBlockItem[] = [];
    for (const section of smartBlockSections) {
      const sectionTitle = section.sectionTitle.toLowerCase();
      const isTargetSection = 
        sectionTitle.includes("뉴스") ||
        sectionTitle.includes("news") ||
        sectionTitle.includes("view") ||
        sectionTitle.includes("블로그") ||
        sectionTitle.includes("blog") ||
        sectionTitle.includes("포스트") ||
        sectionTitle.includes("인플루언서") ||
        sectionTitle.includes("콘텐츠") ||
        sectionTitle.includes("관련") ||
        sectionTitle.includes("추천");
        
      if (isTargetSection) {
        console.log(`[SOV] Including section: "${section.sectionTitle}" (${section.posts.length} posts)`);
        for (const post of section.posts) {
          flatItems.push({
            blockType: section.sectionTitle,
            title: post.title,
            url: post.url,
            description: post.summary || "",
          });
        }
      } else {
        console.log(`[SOV] Skipping section: "${section.sectionTitle}"`);
      }
    }

    if (flatItems.length === 0) {
      await updateRunStatus(runId, "completed", 0, 0);
      return;
    }

    await updateRunStatus(runId, "extracting", flatItems.length, 0);

    const exposures: SovExposure[] = [];
    for (let i = 0; i < flatItems.length; i++) {
      const item = flatItems[i];
      const [exposure] = await db
        .insert(sovExposures)
        .values({
          runId,
          blockType: item.blockType,
          title: item.title,
          url: item.url,
          description: item.description || null,
          position: String(i + 1),
        })
        .returning();
      exposures.push(exposure);
    }

    await updateRunStatus(runId, "analyzing");

    const brandEmbeddings: Map<string, number[]> = new Map();
    for (const brand of run.brands) {
      const brandText = `${brand} 브랜드 회사 기업 제품 서비스`;
      const embedding = await getEmbedding(brandText);
      brandEmbeddings.set(brand, embedding);
    }

    let processedCount = 0;
    const brandExposureCounts: Map<string, number> = new Map();
    const brandExposureByType: Map<string, Map<string, number>> = new Map();
    const blockTypeTotals: Map<string, number> = new Map();
    
    run.brands.forEach((brand) => {
      brandExposureCounts.set(brand, 0);
      brandExposureByType.set(brand, new Map());
    });

    for (const exposure of exposures) {
      blockTypeTotals.set(
        exposure.blockType,
        (blockTypeTotals.get(exposure.blockType) || 0) + 1
      );
    }

    const extractionTasks = exposures.map((exposure) =>
      contentExtractionLimit(async () => {
        try {
          const { content, status } = await extractContent(exposure.url);

          await db
            .update(sovExposures)
            .set({
              extractedContent: content,
              extractionStatus: status,
            })
            .where(eq(sovExposures.id, exposure.id));

          if (content) {
            const contentEmbedding = await getEmbedding(content);

            for (const brand of run.brands) {
              const ruleScore = calculateRuleScore(content, brand);
              const semanticScore = await calculateSemanticScore(
                contentEmbedding,
                brandEmbeddings.get(brand)!
              );
              const combinedScore = calculateCombinedScore(ruleScore, semanticScore);
              const isRelevant = ruleScore >= 0.8 || combinedScore >= RELEVANCE_THRESHOLD;

              await db.insert(sovScores).values({
                exposureId: exposure.id,
                brand,
                ruleScore: ruleScore.toFixed(4),
                semanticScore: semanticScore.toFixed(4),
                combinedScore: combinedScore.toFixed(4),
                isRelevant: isRelevant ? "true" : "false",
              });

              if (isRelevant) {
                brandExposureCounts.set(
                  brand,
                  (brandExposureCounts.get(brand) || 0) + 1
                );
                const typeMap = brandExposureByType.get(brand)!;
                typeMap.set(
                  exposure.blockType,
                  (typeMap.get(exposure.blockType) || 0) + 1
                );
              }
            }
          }

          processedCount++;
          await updateRunStatus(runId, "analyzing", flatItems.length, processedCount);
        } catch (error) {
          console.error(`[SOV] Error processing exposure ${exposure.id}:`, error);
        }
      })
    );

    await Promise.all(extractionTasks);

    const totalExposures = exposures.length;
    for (const brand of run.brands) {
      const exposureCount = brandExposureCounts.get(brand) || 0;
      const sovPercentage = totalExposures > 0 
        ? ((exposureCount / totalExposures) * 100).toFixed(2)
        : "0.00";

      await db.insert(sovResults).values({
        runId,
        brand,
        exposureCount: String(exposureCount),
        sovPercentage,
      });

      const typeMap = brandExposureByType.get(brand)!;
      for (const blockType of Array.from(blockTypeTotals.keys())) {
        const totalInType = blockTypeTotals.get(blockType)!;
        const countInType = typeMap.get(blockType) || 0;
        const typePercentage = totalInType > 0 
          ? ((countInType / totalInType) * 100).toFixed(2)
          : "0.00";

        await db.insert(sovResultsByType).values({
          runId,
          blockType,
          brand,
          exposureCount: String(countInType),
          totalInType: String(totalInType),
          sovPercentage: typePercentage,
        });
      }
    }

    await updateRunStatus(runId, "completed", totalExposures, totalExposures);
  } catch (error) {
    console.error("[SOV] Run execution failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateRunStatus(runId, "failed", undefined, undefined, errorMessage);
  }
}
