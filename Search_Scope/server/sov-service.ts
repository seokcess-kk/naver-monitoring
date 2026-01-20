import OpenAI from "openai";
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
import puppeteer, { Browser, Page } from "puppeteer";
import pLimit from "p-limit";
import { 
  extractContent as extractContentNew, 
  extractMetadata,
  logExtractionSummary, 
  resetExtractionStats,
  type ExtractionResult 
} from "./content-extractor";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RELEVANCE_THRESHOLD = 0.72;
const RULE_WEIGHT = 0.4;
const SEMANTIC_WEIGHT = 0.6;

const contentExtractionLimit = pLimit(5);

interface FlatSmartBlockItem {
  blockType: string;
  title: string;
  url: string;
  description: string;
}

let sharedBrowser: Browser | null = null;
let browserUseCount = 0;
const MAX_BROWSER_USES = 20;

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser || browserUseCount >= MAX_BROWSER_USES) {
    if (sharedBrowser) {
      try {
        await sharedBrowser.close();
      } catch (e) {
        console.log("[SOV] Failed to close old browser:", e);
      }
    }
    sharedBrowser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    browserUseCount = 0;
    console.log("[SOV] New shared browser instance created");
  }
  browserUseCount++;
  return sharedBrowser;
}

export async function closeSovBrowser(): Promise<void> {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
      sharedBrowser = null;
      browserUseCount = 0;
      console.log("[SOV] Shared browser closed");
    } catch (e) {
      console.log("[SOV] Error closing shared browser:", e);
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function extractImagesFromPage(url: string): Promise<string[]> {
  let page: Page | null = null;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    const imageUrls = await page.evaluate(() => {
      const contentSelectors = [
        ".se-main-container",
        ".post_ct",
        ".content_view",
        "article",
        ".article_body",
        "#dic_area",
        ".newsct_article"
      ];
      
      let container: Element | null = null;
      for (const selector of contentSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          container = el;
          break;
        }
      }
      
      const targetElement = container || document.body;
      const images = targetElement.querySelectorAll("img");
      const urls: string[] = [];
      
      images.forEach((img) => {
        const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy-src");
        if (src && 
            src.startsWith("http") && 
            !src.includes("icon") && 
            !src.includes("logo") &&
            !src.includes("button") &&
            !src.includes("banner") &&
            img.width > 100 && 
            img.height > 100) {
          urls.push(src);
        }
      });
      
      return urls.slice(0, 3);
    });

    console.log(`[SOV] Extracted ${imageUrls.length} images from: ${url}`);
    return imageUrls;
  } catch (error) {
    console.error("[SOV] Image extraction failed:", error);
    return [];
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
  }
}

async function extractTextFromImages(imageUrls: string[]): Promise<string | null> {
  if (imageUrls.length === 0) {
    return null;
  }

  try {
    console.log(`[SOV] Analyzing ${imageUrls.length} images with Vision API`);
    
    const contentParts: Array<{type: "text", text: string} | {type: "image_url", image_url: {url: string, detail: "low"}}> = [
      {
        type: "text",
        text: "이 이미지들에서 보이는 모든 텍스트를 추출해주세요. 브랜드명, 회사명, 제품명, 서비스명을 특히 주의해서 찾아주세요. 텍스트만 추출하고 설명은 필요없습니다.",
      },
    ];
    
    for (const url of imageUrls.slice(0, 3)) {
      contentParts.push({
        type: "image_url",
        image_url: { url, detail: "low" },
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: contentParts as any,
        },
      ],
      max_tokens: 1000,
    });

    const extractedText = response.choices[0]?.message?.content;
    if (extractedText && extractedText.length > 10) {
      console.log(`[SOV] Vision API extracted: ${extractedText.length} chars`);
      return extractedText;
    }
    
    return null;
  } catch (error) {
    console.error("[SOV] Vision API error:", error);
    return null;
  }
}

const OCR_ELIGIBLE_TYPES = ["blog", "cafe", "post"];

async function extractContent(
  url: string, 
  apiDescription?: string
): Promise<{ content: string | null; status: string; urlType: string }> {
  const result = await extractContentNew(url, apiDescription);
  
  if (result.content) {
    return { content: result.content, status: result.status, urlType: result.urlType };
  }
  
  if (result.status === "failed") {
    const isOcrEligible = OCR_ELIGIBLE_TYPES.some(type => 
      result.urlType.toLowerCase().includes(type) || url.includes(type)
    );
    
    if (isOcrEligible && (!apiDescription || apiDescription.length < 50)) {
      console.log(`[SOV] Text extraction failed, trying image OCR for: ${url}`);
      const imageUrls = await withTimeout(extractImagesFromPage(url), 15000, []);
      if (imageUrls.length > 0) {
        const imageText = await withTimeout(extractTextFromImages(imageUrls), 20000, null);
        if (imageText) {
          return { content: imageText, status: "success_ocr", urlType: result.urlType };
        }
      }
    } else {
      console.log(`[SOV] Skipping OCR for ${result.urlType} (not eligible or has description)`);
    }
    
    if (apiDescription && apiDescription.length > 30) {
      console.log(`[SOV] Using API description fallback: ${apiDescription.length} chars`);
      return { content: apiDescription, status: "success_api", urlType: result.urlType };
    }
  }
  
  return { content: result.content, status: result.status, urlType: result.urlType };
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

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "").replace(/[^\w\uAC00-\uD7A3]/g, "");
}

function checkBrandMatch(content: string, brand: string): boolean {
  const normalizedContent = normalizeText(content);
  const normalizedBrand = normalizeText(brand);
  
  if (normalizedContent.includes(normalizedBrand)) {
    return true;
  }
  
  const lowerContent = content.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  if (lowerContent.includes(lowerBrand)) {
    return true;
  }
  
  return false;
}

function calculateRuleScore(content: string, brand: string): number {
  const lowerContent = content.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  
  if (checkBrandMatch(content, brand)) {
    return 1.0;
  }
  
  const brandWords = lowerBrand.split(/\s+/);
  let matchCount = 0;
  
  for (const word of brandWords) {
    if (word.length >= 2 && lowerContent.includes(word)) {
      matchCount++;
    }
  }

  const partialRatio = brandWords.length > 0 ? matchCount / brandWords.length : 0;
  return partialRatio * 0.8;
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

    resetExtractionStats();
    await updateRunStatus(runId, "crawling");

    const smartBlockSections = await crawlNaverSearch(run.marketKeyword);
    
    console.log(`[SOV] Crawled ${smartBlockSections.length} sections for keyword: ${run.marketKeyword}`);
    for (const section of smartBlockSections) {
      console.log(`[SOV] Section: "${section.sectionTitle}" with ${section.posts.length} posts`);
    }
    
    const flatItems: FlatSmartBlockItem[] = [];
    const mapPlacePatterns = [
      "지도", "map", "플레이스", "place", "장소", 
      "위치", "location", "매장", "store", "업체"
    ];
    
    for (const section of smartBlockSections) {
      const sectionTitle = section.sectionTitle.toLowerCase();
      const normalizedTitle = sectionTitle.replace(/\s+/g, "");
      
      const isExcludedSection = mapPlacePatterns.some(pattern => 
        normalizedTitle.includes(pattern.toLowerCase())
      );
        
      if (isExcludedSection) {
        console.log(`[SOV] Excluding map/place section: "${section.sectionTitle}"`);
      } else {
        console.log(`[SOV] Including section: "${section.sectionTitle}" (${section.posts.length} posts)`);
        for (const post of section.posts) {
          flatItems.push({
            blockType: section.sectionTitle,
            title: post.title,
            url: post.url,
            description: post.summary || "",
          });
        }
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
          const { content, status } = await extractContent(exposure.url, exposure.description || undefined);

          let finalContent = content;
          let finalStatus = status;

          if (!content) {
            console.log(`[SOV] Content extraction failed for ${exposure.url}, trying metadata fallback...`);
            const metadata = await extractMetadata(exposure.url);
            
            if (metadata.success) {
              const metadataText = [
                exposure.title || "",
                metadata.title || "",
                metadata.description || "",
              ].filter(Boolean).join(" ");
              
              if (metadataText.length > 10) {
                let hasMatchingBrand = false;
                for (const brand of run.brands) {
                  if (checkBrandMatch(metadataText, brand)) {
                    hasMatchingBrand = true;
                    break;
                  }
                }
                
                if (hasMatchingBrand) {
                  finalContent = metadataText;
                  finalStatus = "success_metadata";
                  console.log(`[SOV] Metadata fallback success: ${metadataText.length} chars with brand match`);
                } else {
                  console.log(`[SOV] Metadata extracted but no brand match found`);
                }
              }
            }
          }

          await db
            .update(sovExposures)
            .set({
              extractedContent: finalContent,
              extractionStatus: finalStatus,
            })
            .where(eq(sovExposures.id, exposure.id));

          if (finalContent) {
            const contentEmbedding = await getEmbedding(finalContent);

            for (const brand of run.brands) {
              const brandFound = checkBrandMatch(finalContent, brand);
              const ruleScore = brandFound ? 1.0 : calculateRuleScore(finalContent, brand);
              const semanticScore = await calculateSemanticScore(
                contentEmbedding,
                brandEmbeddings.get(brand)!
              );
              const combinedScore = calculateCombinedScore(ruleScore, semanticScore);
              const isRelevant = brandFound || ruleScore >= 0.8 || combinedScore >= RELEVANCE_THRESHOLD;

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

    logExtractionSummary();
    await closeSovBrowser();
    await updateRunStatus(runId, "completed", totalExposures, totalExposures);
  } catch (error) {
    console.error("[SOV] Run execution failed:", error);
    logExtractionSummary();
    await closeSovBrowser();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateRunStatus(runId, "failed", undefined, undefined, errorMessage);
  }
}
