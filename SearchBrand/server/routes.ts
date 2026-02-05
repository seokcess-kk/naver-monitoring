import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { registerAuthRoutes, isAuthenticated } from "./auth-routes";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { findUserById } from "./auth-service";
import { searchAllChannels, searchSingleChannel, QuotaExceededError } from "./naver-api";
import { crawlNaverSearch } from "./crawler";
import { insertApiKeySchema, updateApiKeySchema, popups } from "@shared/schema";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { getKeywordVolume, isConfigured as isNaverAdConfigured, type KeywordVolumeResult } from "./naver-ad-api";
import { getKeywordTrend, isConfigured as isDataLabConfigured, type KeywordTrendData } from "./naver-datalab-api";
import { 
  generateRateLimitKey, 
  validateRequest, 
  toApiKeyPublic 
} from "./utils/request-helpers";
import adminRoutes from "./admin-routes";
import { requireAdmin } from "./admin-middleware";
import placeReviewRoutes, { initPlaceReviewWorker } from "./place-review-routes";
import feedbackRoutes from "./feedback-routes";
import { getAllServicesStatus, getQuickRedisStatus, getQuickChromeStatus } from "./services/service-status";
import { getAvailableSystemApiKey, getSystemQuotaSummary } from "./services/system-api-key-service";

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "검색 요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
  keyGenerator: generateRateLimitKey,
  validate: { xForwardedForHeader: false },
});

const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "API 키 관련 요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
  keyGenerator: generateRateLimitKey,
  validate: { xForwardedForHeader: false },
});

const searchQuerySchema = z.object({
  keyword: z.string().min(1, "키워드는 필수입니다").max(100, "키워드는 100자 이하여야 합니다").transform(s => s.trim()),
  sort: z.enum(["sim", "date"]).default("sim"),
  page: z.string().regex(/^\d+$/, "페이지 번호는 숫자여야 합니다").default("1").transform(s => Math.max(1, Math.min(100, parseInt(s, 10)))),
});

const channelSearchQuerySchema = searchQuerySchema.extend({
  channel: z.enum(["blog", "cafe", "kin", "news"], { message: "유효한 채널이 아닙니다 (blog, cafe, kin, news)" }),
});

async function attachUserToRequest(req: any, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    try {
      const user = await findUserById(req.session.userId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.error("Failed to attach user to request:", error);
    }
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);

  app.use("/api/admin", isAuthenticated, attachUserToRequest, adminRoutes);
  app.use("/api/place-review", placeReviewRoutes);
  app.use("/api/feedback", attachUserToRequest, feedbackRoutes);

  initPlaceReviewWorker().catch((error) => {
    console.log("[PlaceReview] Worker not started (Redis may not be running):", error);
  });

  // Threads 캠페인 리다이렉트 라우트
  const THREADS_UTM_BASE = "/?utm_source=threads&utm_medium=social&utm_campaign=260205_traffic&utm_term=all";
  
  app.get("/threads/insight", (_req, res) => {
    res.redirect(302, `${THREADS_UTM_BASE}&utm_content=insight`);
  });
  
  app.get("/threads/question", (_req, res) => {
    res.redirect(302, `${THREADS_UTM_BASE}&utm_content=question`);
  });
  
  app.get("/threads/light", (_req, res) => {
    res.redirect(302, `${THREADS_UTM_BASE}&utm_content=light`);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/services/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await findUserById(userId);
      if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
        return res.status(403).json({ message: "관리자 권한이 필요합니다" });
      }
      const status = await getAllServicesStatus();
      res.json(status);
    } catch (error) {
      console.error("Service status check error:", error);
      res.status(500).json({ message: "서비스 상태 확인 실패" });
    }
  });

  app.get("/api/services/quick-status", isAuthenticated, (_req, res) => {
    res.json({
      redis: getQuickRedisStatus(),
      chrome: getQuickChromeStatus(),
    });
  });

  app.get("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const apiKey = await storage.getApiKeyByUserId(userId);
      if (!apiKey) {
        return res.json(null);
      }
      res.json(toApiKeyPublic(apiKey));
    } catch (error) {
      console.error("Get API key error:", error);
      res.status(500).json({ message: "Failed to fetch API key" });
    }
  });

  app.post("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      
      const existing = await storage.getApiKeyByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "API key already exists. Use PUT to update." });
      }

      const validation = validateRequest(insertApiKeySchema, {
        userId,
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
      });
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const apiKey = await storage.createApiKey(validation.data);
      res.status(201).json(toApiKeyPublic(apiKey));
    } catch (error) {
      console.error("Create API key error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.put("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;

      const validation = validateRequest(updateApiKeySchema, {
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
      });
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const apiKey = await storage.updateApiKey(userId, validation.data);
      if (!apiKey) {
        return res.status(404).json({ message: "API key not found" });
      }
      res.json(toApiKeyPublic(apiKey));
    } catch (error) {
      console.error("Update API key error:", error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  app.delete("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!
      await storage.deleteApiKey(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Delete API key error:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  app.get("/api/system-quota", isAuthenticated, async (_req, res) => {
    try {
      const summary = await getSystemQuotaSummary();
      res.json(summary);
    } catch (error) {
      console.error("System quota error:", error);
      res.status(500).json({ message: "시스템 쿼터 조회 실패" });
    }
  });

  app.get("/api/search", isAuthenticated, searchLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      
      const validation = validateRequest(searchQuerySchema, req.query);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const { keyword, sort, page } = validation.data;

      const credentials = await getAvailableSystemApiKey();
      if (!credentials) {
        return res.status(503).json({ 
          message: "현재 사용 가능한 API 키가 없습니다. 관리자에게 문의하세요.",
          code: "NO_AVAILABLE_API_KEY"
        });
      }

      const crawlPromise = crawlNaverSearch(keyword).catch((err) => {
        console.error("Crawl error:", err);
        return [];
      });

      const volumePromise = isNaverAdConfigured() 
        ? getKeywordVolume(keyword, userId).catch((err) => {
            console.error("Keyword volume error:", err);
            return null;
          })
        : Promise.resolve(null);

      const trendPromise = isDataLabConfigured()
        ? getKeywordTrend(keyword, userId).catch((err) => {
            console.error("Keyword trend error:", err);
            return null;
          })
        : Promise.resolve(null);

      const [smartBlockResult, searchResult, volumeResult, trendResult] = await Promise.all([
        crawlPromise,
        searchAllChannels(keyword, sort, page, credentials, userId),
        volumePromise,
        trendPromise,
      ]);

      storage.createSearchLog({ userId, searchType: "unified", keyword }).catch((err) => {
        console.error("Search log error:", err);
      });

      const keywordInsight = volumeResult ? {
        keyword: volumeResult.keyword,
        totalVolume: volumeResult.totalVolume,
        pcVolume: volumeResult.monthlyPcQcCnt,
        mobileVolume: volumeResult.monthlyMobileQcCnt,
        compIdx: volumeResult.compIdx,
        momGrowth: trendResult?.momGrowth ?? null,
        yoyGrowth: trendResult?.yoyGrowth ?? null,
        trend: trendResult?.trend ?? null,
      } : null;

      res.json({
        smartBlock: smartBlockResult,
        apiResults: searchResult.results,
        quota: searchResult.quota,
        keywordInsight,
      });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return res.status(429).json({
          message: "모든 API 키의 일일 한도가 소진되었습니다. 내일 다시 시도해주세요.",
          quota: error.quota,
        });
      }
      console.error("Search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/search/channel", isAuthenticated, searchLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      
      const validation = validateRequest(channelSearchQuerySchema, req.query);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const { keyword, channel, sort, page } = validation.data;

      const credentials = await getAvailableSystemApiKey();
      if (!credentials) {
        return res.status(503).json({ 
          message: "현재 사용 가능한 API 키가 없습니다. 관리자에게 문의하세요.",
          code: "NO_AVAILABLE_API_KEY"
        });
      }

      const result = await searchSingleChannel(channel, keyword, sort, page, credentials, userId);

      res.json({ channel, result: result.data, quota: result.quota });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return res.status(429).json({
          message: "모든 API 키의 일일 한도가 소진되었습니다. 내일 다시 시도해주세요.",
          quota: error.quota,
        });
      }
      console.error("Channel search error:", error);
      res.status(500).json({ message: "Channel search failed" });
    }
  });

  const keywordVolumeSchema = z.object({
    keyword: z.string().min(1, "키워드는 필수입니다").max(100, "키워드는 100자 이하여야 합니다").transform(s => s.trim()),
  });

  app.get("/api/keyword-volume", isAuthenticated, searchLimiter, async (req: any, res) => {
    try {
      if (!isNaverAdConfigured()) {
        return res.json({
          keyword: req.query.keyword || "",
          monthlyPcQcCnt: null,
          monthlyMobileQcCnt: null,
          available: false,
          configured: false,
        });
      }

      const validation = validateRequest(keywordVolumeSchema, req.query);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const { keyword } = validation.data;
      const volumeData = await getKeywordVolume(keyword);

      if (!volumeData) {
        return res.json({
          keyword,
          monthlyPcQcCnt: null,
          monthlyMobileQcCnt: null,
          available: false,
          configured: true,
        });
      }

      res.json({
        keyword: volumeData.keyword,
        monthlyPcQcCnt: volumeData.monthlyPcQcCnt,
        monthlyMobileQcCnt: volumeData.monthlyMobileQcCnt,
        available: true,
        configured: true,
      });
    } catch (error) {
      console.error("Keyword volume fetch error:", error);
      res.status(500).json({ message: "검색량 조회에 실패했습니다." });
    }
  });

  // 검색 통계 API
  app.get("/api/search-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const stats = await storage.getSearchStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Search stats error:", error);
      res.status(500).json({ message: "검색 통계 조회에 실패했습니다." });
    }
  });

  // 활성화된 팝업 조회 API (사용자용)
  app.get("/api/popups/active", async (req: any, res) => {
    try {
      const { targetPage } = req.query;
      const now = new Date();

      const conditions = [
        eq(popups.isActive, true),
        lte(popups.startDate, now),
        gte(popups.endDate, now),
      ];

      if (targetPage && targetPage !== "all") {
        conditions.push(
          eq(popups.targetPage, targetPage as string)
        );
      }

      const activePopups = await db
        .select()
        .from(popups)
        .where(and(...conditions))
        .orderBy(desc(popups.priority), desc(popups.createdAt));

      // targetPage가 특정 값인 경우 "all" 타겟 팝업도 포함
      if (targetPage && targetPage !== "all") {
        const allTargetPopups = await db
          .select()
          .from(popups)
          .where(and(
            eq(popups.isActive, true),
            lte(popups.startDate, now),
            gte(popups.endDate, now),
            eq(popups.targetPage, "all")
          ))
          .orderBy(desc(popups.priority), desc(popups.createdAt));

        // 두 결과 합치고 priority 순으로 정렬
        const combined = [...activePopups, ...allTargetPopups].sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
        });

        return res.json(combined);
      }

      res.json(activePopups);
    } catch (error) {
      console.error("Active popups error:", error);
      res.status(500).json({ message: "팝업 조회에 실패했습니다." });
    }
  });

  return httpServer;
}
