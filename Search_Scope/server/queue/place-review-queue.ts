import { Queue, Worker, Job, ConnectionOptions } from "bullmq";
import { db } from "../db";
import { placeReviewJobs, placeReviews, placeReviewAnalyses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrapePlaceReviews } from "../services/place-review-scraper";
import { analyzeReview } from "../services/place-review-analyzer";

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

export function getPlaceReviewQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedisConfig() });
    console.log("[PlaceReviewQueue] Queue initialized");
  }
  return queue;
}

export async function addPlaceReviewJob(data: PlaceReviewJobData): Promise<string> {
  const q = getPlaceReviewQueue();
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
      .set({ status: "processing", progress: "0" })
      .where(eq(placeReviewJobs.id, jobId));

    const reviews = await scrapePlaceReviews({
      placeId,
      mode,
      limitQty,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      onProgress: async (current, total) => {
        const progress = Math.round((current / total) * 50);
        await db.update(placeReviewJobs)
          .set({ progress: String(progress), totalReviews: String(total) })
          .where(eq(placeReviewJobs.id, jobId));
        await job.updateProgress(progress);
      },
    });

    console.log(`[PlaceReviewWorker] Scraped ${reviews.length} reviews`);

    await db.update(placeReviewJobs)
      .set({ totalReviews: String(reviews.length), progress: "50" })
      .where(eq(placeReviewJobs.id, jobId));

    let analyzedCount = 0;
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];

      const [insertedReview] = await db.insert(placeReviews).values({
        jobId,
        reviewText: review.text,
        reviewDate: review.date,
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
      await db.update(placeReviewJobs)
        .set({ progress: String(progress), analyzedReviews: String(analyzedCount) })
        .where(eq(placeReviewJobs.id, jobId));
      await job.updateProgress(progress);
    }

    await db.update(placeReviewJobs)
      .set({
        status: "completed",
        progress: "100",
        analyzedReviews: String(analyzedCount),
        completedAt: new Date(),
      })
      .where(eq(placeReviewJobs.id, jobId));

    console.log(`[PlaceReviewWorker] Job ${jobId} completed. Analyzed ${analyzedCount}/${reviews.length} reviews`);
  } catch (error) {
    console.error(`[PlaceReviewWorker] Job ${jobId} failed:`, error);
    await db.update(placeReviewJobs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(placeReviewJobs.id, jobId));
    throw error;
  }
}

export function startPlaceReviewWorker(): Worker {
  if (worker) {
    return worker;
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
