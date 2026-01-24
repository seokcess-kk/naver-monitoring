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
import puppeteer, { Browser, Page } from "puppeteer-core";
import pLimit from "p-limit";
import { findChromePath } from "./utils/chrome-finder";
import { 
  extractContent as extractContentNew, 
  extractMetadata,
  createExtractionStatsCollector,
  type ExtractionResult,
  type ExtractionStatsCollector 
} from "./content-extractor";
import { logApiUsage } from "./services/api-usage-logger";

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
    const executablePath = findChromePath();
    sharedBrowser = await puppeteer.launch({
      headless: true,
      executablePath,
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

    const startTime = Date.now();
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

    const responseTimeMs = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;
    
    logApiUsage({
      userId: null,
      apiType: "openai",
      endpoint: "chat.completions/vision",
      success: true,
      tokensUsed,
      responseTimeMs,
      metadata: { model: "gpt-4o", imageCount: imageUrls.length },
    });

    const extractedText = response.choices[0]?.message?.content;
    if (extractedText && extractedText.length > 10) {
      console.log(`[SOV] Vision API extracted: ${extractedText.length} chars`);
      return extractedText;
    }
    
    return null;
  } catch (error) {
    logApiUsage({
      userId: null,
      apiType: "openai",
      endpoint: "chat.completions/vision",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error("[SOV] Vision API error:", error);
    return null;
  }
}

const OCR_ELIGIBLE_TYPES = ["blog", "cafe", "post", "news", "view"];
const OCR_MIN_CONTENT_LENGTH = 200;

async function tryOcrExtraction(
  url: string,
  urlType: string
): Promise<string | null> {
  console.log(`[SOV] Trying image OCR for: ${url}`);
  const imageUrls = await withTimeout(extractImagesFromPage(url), 15000, []);
  if (imageUrls.length > 0) {
    const imageText = await withTimeout(extractTextFromImages(imageUrls), 20000, null);
    if (imageText) {
      console.log(`[SOV] OCR success: ${imageText.length} chars from ${imageUrls.length} images`);
      return imageText;
    }
  }
  console.log(`[SOV] OCR failed: no text extracted from images`);
  return null;
}

async function extractContent(
  url: string, 
  apiDescription?: string,
  statsCollector?: ExtractionStatsCollector
): Promise<{ content: string | null; status: string; urlType: string }> {
  const result = await extractContentNew(url, apiDescription, { statsCollector });
  
  const isOcrEligible = OCR_ELIGIBLE_TYPES.some(type => 
    result.urlType.toLowerCase().includes(type) || url.toLowerCase().includes(type)
  );
  
  // 콘텐츠가 너무 짧은 경우 OCR 시도 (이미지 중심 콘텐츠 대응)
  if (result.content && result.content.length < OCR_MIN_CONTENT_LENGTH && isOcrEligible) {
    console.log(`[SOV] Content too short (${result.content.length} chars), trying OCR supplement`);
    const ocrText = await tryOcrExtraction(url, result.urlType);
    if (ocrText && ocrText.length > result.content.length) {
      // OCR 결과가 더 길면 기존 콘텐츠와 합침
      const combined = `${result.content} ${ocrText}`;
      console.log(`[SOV] OCR supplemented: ${result.content.length} → ${combined.length} chars`);
      return { content: combined.slice(0, 8000), status: "success_ocr", urlType: result.urlType };
    }
  }
  
  if (result.content) {
    return { content: result.content, status: result.status, urlType: result.urlType };
  }
  
  // 추출 실패 시 OCR 시도
  if (result.status === "failed" && isOcrEligible) {
    const ocrText = await tryOcrExtraction(url, result.urlType);
    if (ocrText) {
      return { content: ocrText, status: "success_ocr", urlType: result.urlType };
    }
  } else if (result.status === "failed" && !isOcrEligible) {
    console.log(`[SOV] Skipping OCR for ${result.urlType} (not eligible)`);
  }
  
  // API description fallback
  if (apiDescription && apiDescription.length > 30) {
    console.log(`[SOV] Using API description fallback: ${apiDescription.length} chars`);
    return { content: apiDescription, status: "success_api", urlType: result.urlType };
  }
  
  return { content: result.content, status: result.status, urlType: result.urlType };
}

async function getEmbedding(text: string, userId?: string | null): Promise<number[]> {
  const truncatedText = text.slice(0, 8000);
  
  const startTime = Date.now();
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });

    const responseTimeMs = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;
    
    logApiUsage({
      userId,
      apiType: "openai",
      endpoint: "embeddings",
      success: true,
      tokensUsed,
      responseTimeMs,
      metadata: { model: "text-embedding-3-small", inputLength: truncatedText.length },
    });

    return response.data[0].embedding;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    logApiUsage({
      userId,
      apiType: "openai",
      endpoint: "embeddings",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs,
    });
    throw error;
  }
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

const SOV_RUN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max for entire run
const EXTRACTION_TIMEOUT_MS = 45 * 1000; // 45 seconds for content extraction (includes OCR)
const EMBEDDING_TIMEOUT_MS = 15 * 1000; // 15 seconds for embedding generation

interface FailureStats {
  extractionTimeout: number;
  extractionFailed: number;
  embeddingTimeout: number;
  embeddingFailed: number;
  total: number;
}

function formatFailureStats(stats: FailureStats): string {
  const parts: string[] = [];
  if (stats.extractionTimeout > 0) parts.push(`추출 타임아웃 ${stats.extractionTimeout}건`);
  if (stats.extractionFailed > 0) parts.push(`추출 실패 ${stats.extractionFailed}건`);
  if (stats.embeddingTimeout > 0) parts.push(`임베딩 타임아웃 ${stats.embeddingTimeout}건`);
  if (stats.embeddingFailed > 0) parts.push(`임베딩 실패 ${stats.embeddingFailed}건`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

async function updateRunStatus(
  runId: string,
  status: string,
  totalExposures?: number,
  processedExposures?: number,
  errorMessage?: string,
  statusMessage?: string
) {
  const updates: any = { status };
  if (totalExposures !== undefined) updates.totalExposures = String(totalExposures);
  if (processedExposures !== undefined) updates.processedExposures = String(processedExposures);
  if (errorMessage !== undefined) updates.errorMessage = errorMessage;
  if (statusMessage !== undefined) updates.statusMessage = statusMessage;
  if (status === "completed" || status === "failed") {
    updates.completedAt = new Date();
  }

  await db.update(sovRuns).set(updates).where(eq(sovRuns.id, runId));
}

async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function executeSovRun(runId: string): Promise<void> {
  const startTime = Date.now();
  const statsCollector = createExtractionStatsCollector();
  
  try {
    const run = await getSovRun(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    await updateRunStatus(runId, "crawling", undefined, undefined, undefined, "검색 결과 크롤링 중...");

    const smartBlockSections = await executeWithTimeout(
      crawlNaverSearch(run.marketKeyword),
      60000,
      "크롤링 타임아웃 (60초)"
    );
    
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
      await updateRunStatus(runId, "completed", 0, 0, undefined, "분석 완료 (결과 없음)");
      return;
    }

    await updateRunStatus(runId, "extracting", flatItems.length, 0, undefined, `${flatItems.length}개 URL 추출 준비 중...`);

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

    await updateRunStatus(runId, "analyzing", flatItems.length, 0, undefined, "브랜드 임베딩 생성 중...");

    const brandEmbeddings: Map<string, number[]> = new Map();
    for (const brand of run.brands) {
      const brandText = `${brand} 브랜드 회사 기업 제품 서비스`;
      const embedding = await executeWithTimeout(
        getEmbedding(brandText),
        30000,
        `브랜드 임베딩 타임아웃: ${brand}`
      );
      brandEmbeddings.set(brand, embedding);
    }
    
    await updateRunStatus(runId, "analyzing", flatItems.length, 0, undefined, "콘텐츠 분석 시작...");

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

    const failureStats: FailureStats = {
      extractionTimeout: 0,
      extractionFailed: 0,
      embeddingTimeout: 0,
      embeddingFailed: 0,
      total: 0,
    };

    const extractionTasks = exposures.map((exposure) =>
      contentExtractionLimit(async () => {
        let finalContent: string | null = null;
        let finalStatus = "failed";
        let embeddingSuccess = false;

        // 1. 콘텐츠 추출 단계 (별도 타임아웃)
        try {
          const extractionResult = await executeWithTimeout(
            extractContent(exposure.url, exposure.description || undefined, statsCollector),
            EXTRACTION_TIMEOUT_MS,
            `추출 타임아웃: ${exposure.url.slice(0, 40)}...`
          );
          
          finalContent = extractionResult.content;
          finalStatus = extractionResult.status;

          // 추출 실패 시 메타데이터 fallback
          if (!finalContent) {
            console.log(`[SOV] Content extraction failed for ${exposure.url}, trying metadata fallback...`);
            const metadata = await withTimeout(extractMetadata(exposure.url), 10000, { title: null, description: null, success: false });
            
            if (metadata.success) {
              const metadataText = [
                exposure.title || "",
                metadata.title || "",
                metadata.description || "",
              ].filter(Boolean).join(" ");
              
              const MIN_METADATA_LENGTH = 20;
              
              if (metadataText.length >= MIN_METADATA_LENGTH) {
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
                  // 브랜드 매칭 없어도 시장 키워드 매칭 시 low_confidence로 저장
                  const marketKeywordLower = run.marketKeyword.toLowerCase();
                  const metadataLower = metadataText.toLowerCase();
                  const hasMarketKeyword = metadataLower.includes(marketKeywordLower);
                  
                  if (hasMarketKeyword) {
                    finalContent = metadataText;
                    finalStatus = "success_metadata_low";
                    console.log(`[SOV] Metadata fallback low confidence: market keyword "${run.marketKeyword}" found, no brand match`);
                  } else {
                    console.log(`[SOV] Metadata extracted but no brand/market keyword match found`);
                  }
                }
              }
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes("타임아웃")) {
            failureStats.extractionTimeout++;
            console.error(`[SOV] Extraction timeout for ${exposure.id}: ${errorMsg}`);
          } else {
            failureStats.extractionFailed++;
            console.error(`[SOV] Extraction failed for ${exposure.id}: ${errorMsg}`);
          }
          failureStats.total++;
        }

        // DB에 추출 결과 저장 (성공/실패 모두)
        await db
          .update(sovExposures)
          .set({
            extractedContent: finalContent,
            extractionStatus: finalStatus,
          })
          .where(eq(sovExposures.id, exposure.id));

        // 2. 임베딩 단계 (별도 타임아웃, 콘텐츠가 있을 때만)
        // low_confidence 상태는 SOV 계산에서 제외하되 점수는 기록
        const isLowConfidence = finalStatus === "success_metadata_low";
        
        if (finalContent) {
          try {
            const contentEmbedding = await executeWithTimeout(
              getEmbedding(finalContent),
              EMBEDDING_TIMEOUT_MS,
              "임베딩 타임아웃"
            );

            for (const brand of run.brands) {
              const brandFound = checkBrandMatch(finalContent, brand);
              const ruleScore = brandFound ? 1.0 : calculateRuleScore(finalContent, brand);
              const semanticScore = await calculateSemanticScore(
                contentEmbedding,
                brandEmbeddings.get(brand)!
              );
              const combinedScore = calculateCombinedScore(ruleScore, semanticScore);
              const isRelevant = brandFound || ruleScore >= 0.8 || combinedScore >= RELEVANCE_THRESHOLD;

              // low_confidence인 경우 needsReview 플래그 추가
              const needsReview = isLowConfidence ? "true" : "false";

              await db.insert(sovScores).values({
                exposureId: exposure.id,
                brand,
                ruleScore: ruleScore.toFixed(4),
                semanticScore: semanticScore.toFixed(4),
                combinedScore: combinedScore.toFixed(4),
                isRelevant: isRelevant ? "true" : "false",
                needsReview,
              });

              // low_confidence는 SOV 계산에서 제외
              if (isRelevant && !isLowConfidence) {
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
            embeddingSuccess = true;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes("타임아웃")) {
              failureStats.embeddingTimeout++;
              console.error(`[SOV] Embedding timeout for ${exposure.id}: ${errorMsg}`);
            } else {
              failureStats.embeddingFailed++;
              console.error(`[SOV] Embedding failed for ${exposure.id}: ${errorMsg}`);
            }
            failureStats.total++;
          }
        }

        // 진행 상태 업데이트
        processedCount++;
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);
        const remainingItems = flatItems.length - processedCount;
        const avgSecPerItem = processedCount > 0 ? elapsedSec / processedCount : 3;
        const estimatedRemainingSec = Math.round(remainingItems * avgSecPerItem);
        
        let statusMsg = `${processedCount}/${flatItems.length} 분석 완료 (예상 ${estimatedRemainingSec}초 남음)`;
        if (failureStats.total > 0) {
          statusMsg += formatFailureStats(failureStats);
        }
        await updateRunStatus(runId, "analyzing", flatItems.length, processedCount, undefined, statusMsg);
      })
    );

    const globalTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`전체 분석 타임아웃 (${SOV_RUN_TIMEOUT_MS / 60000}분 초과)`)), SOV_RUN_TIMEOUT_MS);
    });

    await Promise.race([
      Promise.all(extractionTasks),
      globalTimeoutPromise
    ]);

    await updateRunStatus(runId, "analyzing", exposures.length, exposures.length, undefined, "결과 집계 중...");

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

    const totalElapsedSec = Math.round((Date.now() - startTime) / 1000);
    statsCollector.logSummary();
    await closeSovBrowser();
    await updateRunStatus(runId, "completed", totalExposures, totalExposures, undefined, 
      `분석 완료 (${totalElapsedSec}초 소요)`);
    console.log(`[SOV] Run ${runId} completed in ${totalElapsedSec}s`);
  } catch (error) {
    console.error("[SOV] Run execution failed:", error);
    statsCollector.logSummary();
    await closeSovBrowser();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateRunStatus(runId, "failed", undefined, undefined, errorMessage, `분석 실패: ${errorMessage}`);
  }
}
