import { Queue, Worker, Job, ConnectionOptions } from "bullmq";
import { db } from "../db";
import { placeReviewJobs, placeReviews, placeReviewAnalyses } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { scrapePlaceReviews } from "../services/place-review-scraper";
import { analyzeReview } from "../services/place-review-analyzer";
import { generateReviewSummary } from "../services/review-summary-generator";
import { checkRedisConnection, isRedisAvailable } from "./redis";

const QUEUE_NAME = "place-review-analysis";

const getRedisConfig = (): ConnectionOptions => ({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,
});

interface PlaceReviewJobData {
  jobId: string;
  placeId: string;
  mode: "QTY" | "DATE" | "DATE_RANGE";
  limitQty?: number;
  startDate?: string;
  endDate?: string;
}

let queue: Queue | null = null;
let worker: Worker | null = null;
let redisChecked = false;

export async function ensureRedisAvailable(): Promise<boolean> {
  if (!redisChecked) {
    const available = await checkRedisConnection();
    redisChecked = true;
    if (!available) {
      console.warn("[PlaceReviewQueue] Redis is not available. Place review analysis will not work.");
    }
    return available;
  }
  return isRedisAvailable();
}

export function getPlaceReviewQueue(): Queue | null {
  if (!isRedisAvailable()) {
    console.warn("[PlaceReviewQueue] Cannot get queue - Redis not available");
    return null;
  }
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedisConfig() });
    console.log("[PlaceReviewQueue] Queue initialized");
  }
  return queue;
}

export async function addPlaceReviewJob(data: PlaceReviewJobData): Promise<string | null> {
  const q = getPlaceReviewQueue();
  if (!q) {
    console.error("[PlaceReviewQueue] Cannot add job - Redis not available");
    return null;
  }
  const job = await q.add("analyze", data, {
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  console.log(`[PlaceReviewQueue] Job added: ${job.id}`);
  return job.id!;
}

async function processPlaceReviewJob(job: Job<PlaceReviewJobData>): Promise<void> {
  const { jobId, placeId, mode, limitQty, startDate, endDate } = job.data;
  console.log(`[PlaceReviewWorker] Processing job ${jobId} for place ${placeId}`);

  try {
    await db.update(placeReviewJobs)
      .set({ status: "processing", progress: "0", statusMessage: "리뷰 크롤링 준비 중..." })
      .where(eq(placeReviewJobs.id, jobId));

    await db.update(placeReviewJobs)
      .set({ statusMessage: "네이버 플레이스 페이지 접속 중..." })
      .where(eq(placeReviewJobs.id, jobId));

    const scrapeResult = await scrapePlaceReviews({
      placeId,
      mode,
      limitQty,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      onProgress: async (current, total) => {
        const progress = Math.round((current / total) * 50);
        const statusMessage = `리뷰 수집 중... ${current}/${total}개`;
        await db.update(placeReviewJobs)
          .set({ progress: String(progress), totalReviews: String(total), statusMessage })
          .where(eq(placeReviewJobs.id, jobId));
        await job.updateProgress(progress);
      },
    });

    const { placeName, reviews } = scrapeResult;
    console.log(`[PlaceReviewWorker] Scraped ${reviews.length} reviews, placeName: "${placeName}"`);

    if (placeName) {
      await db.update(placeReviewJobs)
        .set({ placeName })
        .where(eq(placeReviewJobs.id, jobId));
    }

    if (reviews.length === 0) {
      await db.update(placeReviewJobs)
        .set({ 
          status: "completed", 
          progress: "100", 
          statusMessage: "수집된 리뷰가 없습니다",
          completedAt: new Date() 
        })
        .where(eq(placeReviewJobs.id, jobId));
      return;
    }

    await db.update(placeReviewJobs)
      .set({ totalReviews: String(reviews.length), progress: "50", statusMessage: `${reviews.length}개 리뷰 수집 완료, 분석 시작...` })
      .where(eq(placeReviewJobs.id, jobId));

    let analyzedCount = 0;
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];

      const [insertedReview] = await db.insert(placeReviews).values({
        jobId,
        reviewText: review.text,
        reviewDate: review.date ?? new Date(),
        authorName: review.author || null,
        rating: review.rating || null,
      }).returning();

      try {
        const analysis = await analyzeReview(review.text);
        await db.insert(placeReviewAnalyses).values({
          reviewId: insertedReview.id,
          sentiment: analysis.sentiment,
          aspects: JSON.stringify(analysis.aspects),
          keywords: JSON.stringify(analysis.keywords),
          summary: analysis.summary,
        });
        analyzedCount++;
      } catch (analysisError) {
        console.error(`[PlaceReviewWorker] Analysis failed for review ${insertedReview.id}:`, analysisError);
      }

      const progress = 50 + Math.round(((i + 1) / reviews.length) * 50);
      const remaining = reviews.length - (i + 1);
      const statusMessage = remaining > 0 
        ? `감성 분석 중... ${i + 1}/${reviews.length}개 완료 (${remaining}개 남음)`
        : `분석 완료 처리 중...`;
      await db.update(placeReviewJobs)
        .set({ progress: String(progress), analyzedReviews: String(analyzedCount), statusMessage })
        .where(eq(placeReviewJobs.id, jobId));
      await job.updateProgress(progress);
    }

    await db.update(placeReviewJobs)
      .set({
        progress: "95",
        statusMessage: "AI 요약 생성 중...",
      })
      .where(eq(placeReviewJobs.id, jobId));

    try {
      const sentimentStats = await db.select({
        sentiment: placeReviewAnalyses.sentiment,
        count: sql<number>`count(*)::int`,
      })
        .from(placeReviewAnalyses)
        .innerJoin(placeReviews, eq(placeReviewAnalyses.reviewId, placeReviews.id))
        .where(eq(placeReviews.jobId, jobId))
        .groupBy(placeReviewAnalyses.sentiment);

      const allAnalyses = await db.select({
        keywords: placeReviewAnalyses.keywords,
        sentiment: placeReviewAnalyses.sentiment,
      })
        .from(placeReviewAnalyses)
        .innerJoin(placeReviews, eq(placeReviewAnalyses.reviewId, placeReviews.id))
        .where(eq(placeReviews.jobId, jobId));

      const reviewDates = await db.select({
        minDate: sql<Date>`min(review_date)`,
        maxDate: sql<Date>`max(review_date)`,
      })
        .from(placeReviews)
        .where(eq(placeReviews.jobId, jobId));

      const positive = sentimentStats.find(s => s.sentiment === "Positive")?.count || 0;
      const negative = sentimentStats.find(s => s.sentiment === "Negative")?.count || 0;
      const neutral = sentimentStats.find(s => s.sentiment === "Neutral")?.count || 0;
      const total = positive + negative + neutral;

      const keywordMap: Record<string, { positive: number; negative: number; neutral: number; total: number }> = {};
      allAnalyses.forEach(a => {
        const keywords = JSON.parse(a.keywords || "[]") as string[];
        keywords.forEach(kw => {
          if (!keywordMap[kw]) keywordMap[kw] = { positive: 0, negative: 0, neutral: 0, total: 0 };
          if (a.sentiment === "Positive") keywordMap[kw].positive++;
          else if (a.sentiment === "Negative") keywordMap[kw].negative++;
          else keywordMap[kw].neutral++;
          keywordMap[kw].total++;
        });
      });

      const keywordsWithRatio = Object.entries(keywordMap).map(([keyword, counts]) => ({
        keyword,
        ...counts,
        negativeRatio: counts.total > 0 ? Math.round((counts.negative / counts.total) * 100) : 0,
      }));

      const topNegative = keywordsWithRatio
        .filter(k => k.negative > 0)
        .sort((a, b) => (b.total * b.negative / b.total) - (a.total * a.negative / a.total))
        .slice(0, 3)
        .map(k => ({ keyword: k.keyword, negativeRatio: k.negativeRatio }));

      const topPositive = keywordsWithRatio
        .filter(k => k.positive > 0)
        .sort((a, b) => (b.total * b.positive / b.total) - (a.total * a.positive / a.total))
        .slice(0, 3)
        .map(k => k.keyword);

      const minDate = reviewDates[0]?.minDate;
      const maxDate = reviewDates[0]?.maxDate;
      const period = minDate && maxDate
        ? `${new Date(minDate).toLocaleDateString("ko-KR")} ~ ${new Date(maxDate).toLocaleDateString("ko-KR")}`
        : "분석 기간";

      const summaryResult = await generateReviewSummary({
        period,
        totalReviews: total,
        sentimentSummary: {
          positive: total > 0 ? Math.round((positive / total) * 100) : 0,
          neutral: total > 0 ? Math.round((neutral / total) * 100) : 0,
          negative: total > 0 ? Math.round((negative / total) * 100) : 0,
        },
        topNegativeKeywords: topNegative,
        topPositiveKeywords: topPositive,
      });

      await db.update(placeReviewJobs)
        .set({
          status: "completed",
          progress: "100",
          analyzedReviews: String(analyzedCount),
          statusMessage: `분석 완료: ${analyzedCount}/${reviews.length}개 리뷰`,
          aiSummary: summaryResult.summary,
          aiSuggestions: JSON.stringify(summaryResult.suggestions),
          completedAt: new Date(),
        })
        .where(eq(placeReviewJobs.id, jobId));

      console.log(`[PlaceReviewWorker] Job ${jobId} completed with AI summary. Analyzed ${analyzedCount}/${reviews.length} reviews`);
    } catch (summaryError) {
      console.error(`[PlaceReviewWorker] AI summary generation failed for job ${jobId}:`, summaryError);
      await db.update(placeReviewJobs)
        .set({
          status: "completed",
          progress: "100",
          analyzedReviews: String(analyzedCount),
          statusMessage: `분석 완료: ${analyzedCount}/${reviews.length}개 리뷰 (AI 요약 실패)`,
          completedAt: new Date(),
        })
        .where(eq(placeReviewJobs.id, jobId));
      console.log(`[PlaceReviewWorker] Job ${jobId} completed without AI summary. Analyzed ${analyzedCount}/${reviews.length} reviews`);
    }
  } catch (error) {
    console.error(`[PlaceReviewWorker] Job ${jobId} failed:`, error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await db.update(placeReviewJobs)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        statusMessage: `분석 실패: ${errorMsg}`,
      })
      .where(eq(placeReviewJobs.id, jobId));
    throw error;
  }
}

export async function startPlaceReviewWorker(): Promise<Worker | null> {
  if (worker) {
    return worker;
  }

  const redisAvailable = await ensureRedisAvailable();
  if (!redisAvailable) {
    console.warn("[PlaceReviewWorker] Cannot start worker - Redis not available");
    console.warn("[PlaceReviewWorker] Place review analysis will be disabled");
    return null;
  }

  worker = new Worker(QUEUE_NAME, processPlaceReviewJob, {
    connection: getRedisConfig(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[PlaceReviewWorker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[PlaceReviewWorker] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error("[PlaceReviewWorker] Worker error:", error);
  });

  console.log("[PlaceReviewWorker] Worker started");
  return worker;
}

export async function closePlaceReviewQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
