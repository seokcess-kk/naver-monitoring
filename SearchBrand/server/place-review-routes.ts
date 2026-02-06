import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "./db";
import { placeReviewJobs, placeReviews, placeReviewAnalyses } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { addPlaceReviewJob, startPlaceReviewWorker } from "./queue/place-review-queue";

const router = Router();

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(str: string): boolean {
  if (!ISO_DATE_REGEX.test(str)) return false;
  const d = new Date(str + "T00:00:00");
  return !isNaN(d.getTime());
}

const createJobSchema = z.object({
  placeId: z.string().min(1).max(50),
  mode: z.enum(["QTY", "DATE", "DATE_RANGE"]).default("QTY"),
  limitQty: z.number().min(1).max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine(
  (data) => {
    if (data.mode === "QTY" && !data.limitQty) return false;
    if (data.mode === "DATE" && !data.startDate) return false;
    if (data.mode === "DATE_RANGE" && (!data.startDate || !data.endDate)) return false;
    return true;
  },
  { message: "모드에 맞는 필수 파라미터를 입력해주세요" }
).refine(
  (data) => {
    if (data.startDate && !isValidISODate(data.startDate)) return false;
    if (data.endDate && !isValidISODate(data.endDate)) return false;
    return true;
  },
  { message: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)" }
).refine(
  (data) => {
    if (data.mode === "DATE_RANGE" && data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: "시작일이 종료일보다 이후일 수 없습니다" }
);

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  next();
}

router.post("/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const parsed = createJobSchema.parse(req.body);

    const [job] = await db.insert(placeReviewJobs).values({
      userId,
      placeId: parsed.placeId,
      mode: parsed.mode,
      limitQty: parsed.limitQty ? String(parsed.limitQty) : null,
      startDate: parsed.startDate ? new Date(parsed.startDate + "T00:00:00") : null,
      endDate: parsed.endDate ? new Date(parsed.endDate + "T00:00:00") : null,
      status: "queued",
    }).returning();

    try {
      const queueJobId = await addPlaceReviewJob({
        jobId: job.id,
        placeId: parsed.placeId,
        mode: parsed.mode,
        limitQty: parsed.limitQty,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      });
      
      if (!queueJobId) {
        await db.update(placeReviewJobs)
          .set({ status: "failed", errorMessage: "Redis 서버 연결 실패" })
          .where(eq(placeReviewJobs.id, job.id));
        return res.status(503).json({ error: "플레이스 리뷰 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요." });
      }
    } catch (queueError) {
      console.error("[PlaceReview] Failed to add job to queue:", queueError);
      await db.update(placeReviewJobs)
        .set({ status: "failed", errorMessage: "작업 큐 연결 실패" })
        .where(eq(placeReviewJobs.id, job.id));
      return res.status(503).json({ error: "작업 큐 서비스를 사용할 수 없습니다. Redis 서버를 확인해주세요." });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      message: "분석 작업이 시작되었습니다",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[PlaceReview] Create job error:", error);
    res.status(500).json({ error: "작업 생성 실패" });
  }
});

router.get("/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const jobs = await db.select()
      .from(placeReviewJobs)
      .where(eq(placeReviewJobs.userId, userId))
      .orderBy(desc(placeReviewJobs.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ jobs });
  } catch (error) {
    console.error("[PlaceReview] List jobs error:", error);
    res.status(500).json({ error: "작업 목록 조회 실패" });
  }
});

router.get("/jobs/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { jobId } = req.params;

    const [job] = await db.select()
      .from(placeReviewJobs)
      .where(and(eq(placeReviewJobs.id, jobId), eq(placeReviewJobs.userId, userId)));

    if (!job) {
      return res.status(404).json({ error: "작업을 찾을 수 없습니다" });
    }

    res.json({ job });
  } catch (error) {
    console.error("[PlaceReview] Get job error:", error);
    res.status(500).json({ error: "작업 조회 실패" });
  }
});

router.get("/jobs/:jobId/reviews", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { jobId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const [job] = await db.select()
      .from(placeReviewJobs)
      .where(and(eq(placeReviewJobs.id, jobId), eq(placeReviewJobs.userId, userId)));

    if (!job) {
      return res.status(404).json({ error: "작업을 찾을 수 없습니다" });
    }

    const reviews = await db.select({
      id: placeReviews.id,
      reviewText: placeReviews.reviewText,
      reviewDate: placeReviews.reviewDate,
      authorName: placeReviews.authorName,
      rating: placeReviews.rating,
      sentiment: placeReviewAnalyses.sentiment,
      aspects: placeReviewAnalyses.aspects,
      keywords: placeReviewAnalyses.keywords,
      summary: placeReviewAnalyses.summary,
    })
      .from(placeReviews)
      .leftJoin(placeReviewAnalyses, eq(placeReviews.id, placeReviewAnalyses.reviewId))
      .where(eq(placeReviews.jobId, jobId))
      .orderBy(desc(placeReviews.reviewDate))
      .limit(limit)
      .offset(offset);

    const parsedReviews = reviews.map((review) => ({
      ...review,
      aspects: review.aspects ? JSON.parse(review.aspects) : [],
      keywords: review.keywords ? JSON.parse(review.keywords) : [],
    }));

    res.json({ reviews: parsedReviews, job });
  } catch (error) {
    console.error("[PlaceReview] Get reviews error:", error);
    res.status(500).json({ error: "리뷰 조회 실패" });
  }
});

router.get("/jobs/:jobId/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { jobId } = req.params;

    const [job] = await db.select()
      .from(placeReviewJobs)
      .where(and(eq(placeReviewJobs.id, jobId), eq(placeReviewJobs.userId, userId)));

    if (!job) {
      return res.status(404).json({ error: "작업을 찾을 수 없습니다" });
    }

    const sentimentStats = await db.select({
      sentiment: placeReviewAnalyses.sentiment,
      count: sql<number>`count(*)::int`,
    })
      .from(placeReviewAnalyses)
      .innerJoin(placeReviews, eq(placeReviewAnalyses.reviewId, placeReviews.id))
      .where(eq(placeReviews.jobId, jobId))
      .groupBy(placeReviewAnalyses.sentiment);

    const allAnalyses = await db.select({
      aspects: placeReviewAnalyses.aspects,
    })
      .from(placeReviewAnalyses)
      .innerJoin(placeReviews, eq(placeReviewAnalyses.reviewId, placeReviews.id))
      .where(eq(placeReviews.jobId, jobId));

    const aspectCounts: Record<string, { Positive: number; Negative: number; Neutral: number }> = {};
    const keywordCounts: Record<string, number> = {};

    for (const analysis of allAnalyses) {
      const aspects = JSON.parse(analysis.aspects || "[]") as Array<{ aspect: string; sentiment: string }>;
      for (const asp of aspects) {
        if (!aspectCounts[asp.aspect]) {
          aspectCounts[asp.aspect] = { Positive: 0, Negative: 0, Neutral: 0 };
        }
        const sentiment = asp.sentiment as "Positive" | "Negative" | "Neutral";
        if (aspectCounts[asp.aspect][sentiment] !== undefined) {
          aspectCounts[asp.aspect][sentiment]++;
        }
      }
    }

    const allKeywords = await db.select({
      keywords: placeReviewAnalyses.keywords,
    })
      .from(placeReviewAnalyses)
      .innerJoin(placeReviews, eq(placeReviewAnalyses.reviewId, placeReviews.id))
      .where(eq(placeReviews.jobId, jobId));

    for (const row of allKeywords) {
      const keywords = JSON.parse(row.keywords || "[]") as string[];
      for (const kw of keywords) {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    }

    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    res.json({
      job,
      sentimentStats,
      aspectStats: Object.entries(aspectCounts).map(([aspect, counts]) => ({
        aspect,
        ...counts,
        total: counts.Positive + counts.Negative + counts.Neutral,
      })),
      topKeywords,
    });
  } catch (error) {
    console.error("[PlaceReview] Get stats error:", error);
    res.status(500).json({ error: "통계 조회 실패" });
  }
});

router.delete("/jobs/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { jobId } = req.params;

    const [job] = await db.select()
      .from(placeReviewJobs)
      .where(and(eq(placeReviewJobs.id, jobId), eq(placeReviewJobs.userId, userId)));

    if (!job) {
      return res.status(404).json({ error: "작업을 찾을 수 없습니다" });
    }

    await db.delete(placeReviewJobs).where(eq(placeReviewJobs.id, jobId));

    res.json({ message: "작업이 삭제되었습니다" });
  } catch (error) {
    console.error("[PlaceReview] Delete job error:", error);
    res.status(500).json({ error: "작업 삭제 실패" });
  }
});

export async function initPlaceReviewWorker(): Promise<void> {
  try {
    const worker = await startPlaceReviewWorker();
    if (worker) {
      console.log("[PlaceReview] Worker initialized");
    } else {
      console.warn("[PlaceReview] Worker not started - Redis may not be available");
    }
  } catch (error) {
    console.error("[PlaceReview] Failed to start worker:", error);
  }
}

export default router;
