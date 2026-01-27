import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, isAuthenticated } from "./auth-routes";
import { findUserById } from "./auth-service";
import { searchAllChannels, searchSingleChannel, QuotaExceededError } from "./naver-api";
import { crawlNaverSearch } from "./crawler";
import { insertApiKeySchema, updateApiKeySchema } from "@shared/schema";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { getKeywordVolume, isConfigured as isNaverAdConfigured } from "./naver-ad-api";
import { 
  generateRateLimitKey, 
  validateRequest, 
  toApiKeyPublic 
} from "./utils/request-helpers";
import adminRoutes from "./admin-routes";
import { requireAdmin } from "./admin-middleware";
import placeReviewRoutes, { initPlaceReviewWorker } from "./place-review-routes";
import { getAllServicesStatus, getQuickRedisStatus, getQuickChromeStatus } from "./services/service-status";

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

  initPlaceReviewWorker().catch((error) => {
    console.log("[PlaceReview] Worker not started (Redis may not be running):", error);
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

  app.get("/api/search", isAuthenticated, searchLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      
      const validation = validateRequest(searchQuerySchema, req.query);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const { keyword, sort, page } = validation.data;

      const apiKey = await storage.getApiKeyByUserId(userId);
      if (!apiKey) {
        return res.status(400).json({ message: "API key not configured" });
      }

      const credentials = {
        clientId: apiKey.clientId,
        clientSecret: apiKey.clientSecret,
      };

      const [smartBlock, searchResult] = await Promise.all([
        crawlNaverSearch(keyword).catch((err) => {
          console.error("Crawl error:", err);
          return [];
        }),
        searchAllChannels(keyword, sort, page, credentials, userId),
      ]);

      storage.createSearchLog({ userId, searchType: "unified", keyword }).catch((err) => {
        console.error("Search log error:", err);
      });

      res.json({
        smartBlock,
        apiResults: searchResult.results,
        quota: searchResult.quota,
      });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return res.status(429).json({
          message: error.message,
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

      const apiKey = await storage.getApiKeyByUserId(userId);
      if (!apiKey) {
        return res.status(400).json({ message: "API key not configured" });
      }

      const credentials = {
        clientId: apiKey.clientId,
        clientSecret: apiKey.clientSecret,
      };

      const result = await searchSingleChannel(channel, keyword, sort, page, credentials, userId);

      res.json({ channel, result: result.data, quota: result.quota });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return res.status(429).json({
          message: error.message,
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

  return httpServer;
}
