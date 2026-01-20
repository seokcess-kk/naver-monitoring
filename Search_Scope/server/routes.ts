import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, isAuthenticated } from "./auth-routes";
import { findUserById } from "./auth-service";
import { searchAllChannels, searchSingleChannel } from "./naver-api";
import { crawlNaverSearch } from "./crawler";
import { insertApiKeySchema, updateApiKeySchema } from "@shared/schema";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { createSovRun, executeSovRun, getSovResultsByRun, getSovExposuresByRun, getSovResultsByTypeForRun } from "./sov-service";
import { getKeywordVolume, isConfigured as isNaverAdConfigured } from "./naver-ad-api";
import { 
  generateRateLimitKey, 
  validateRequest, 
  assertSovRunAccessible, 
  toApiKeyPublic 
} from "./utils/request-helpers";
import adminRoutes from "./admin-routes";
import placeReviewRoutes, { initPlaceReviewWorker } from "./place-review-routes";

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

  try {
    initPlaceReviewWorker();
  } catch (error) {
    console.log("[PlaceReview] Worker not started (Redis may not be running):", error);
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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

      const [smartBlock, apiResults] = await Promise.all([
        crawlNaverSearch(keyword).catch((err) => {
          console.error("Crawl error:", err);
          return [];
        }),
        searchAllChannels(keyword, sort, page, credentials),
      ]);

      // 검색 로그 기록
      storage.createSearchLog({ userId, searchType: "unified", keyword }).catch((err) => {
        console.error("Search log error:", err);
      });

      res.json({
        smartBlock,
        apiResults,
      });
    } catch (error) {
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

      const result = await searchSingleChannel(channel, keyword, sort, page, credentials);

      res.json({ channel, result });
    } catch (error) {
      console.error("Channel search error:", error);
      res.status(500).json({ message: "Channel search failed" });
    }
  });

  const sovRunSchema = z.object({
    marketKeyword: z.string().min(1, "키워드는 필수입니다").max(100, "키워드는 100자 이하여야 합니다"),
    brands: z.array(z.string().min(1)).min(1, "최소 1개 이상의 브랜드가 필요합니다").max(10, "브랜드는 최대 10개까지 가능합니다"),
  });

  const sovLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "SOV 분석 요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
    keyGenerator: generateRateLimitKey,
    validate: { xForwardedForHeader: false },
  });

  app.post("/api/sov/run", isAuthenticated, sovLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      
      const validation = validateRequest(sovRunSchema, req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const { marketKeyword, brands } = validation.data;

      const run = await createSovRun(userId, marketKeyword, brands);

      // SOV 분석 로그 기록
      storage.createSearchLog({ userId, searchType: "sov", keyword: marketKeyword }).catch((err) => {
        console.error("Search log error:", err);
      });

      executeSovRun(run.id).catch((error) => {
        console.error("[SOV] Background execution failed:", error);
      });

      res.status(201).json({
        runId: run.id,
        status: run.status,
        message: "SOV 분석이 시작되었습니다.",
      });
    } catch (error) {
      console.error("SOV run creation error:", error);
      res.status(500).json({ message: "SOV 분석 시작에 실패했습니다." });
    }
  });

  app.get("/api/sov/status/:runId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { runId } = req.params;

      const access = await assertSovRunAccessible(runId, userId);
      if (!access.success) {
        return res.status(access.status).json({ message: access.message });
      }
      const { run } = access;

      res.json({
        runId: run.id,
        status: run.status,
        marketKeyword: run.marketKeyword,
        brands: run.brands,
        totalExposures: run.totalExposures,
        processedExposures: run.processedExposures,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      });
    } catch (error) {
      console.error("SOV status check error:", error);
      res.status(500).json({ message: "상태 조회에 실패했습니다." });
    }
  });

  app.get("/api/sov/result/:runId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { runId } = req.params;

      const access = await assertSovRunAccessible(runId, userId);
      if (!access.success) {
        return res.status(access.status).json({ message: access.message });
      }
      const { run } = access;

      const results = await getSovResultsByRun(runId);
      const exposures = await getSovExposuresByRun(runId);
      const resultsByType = await getSovResultsByTypeForRun(runId);

      const verifiedCount = exposures.filter(
        (e) => e.extractionStatus?.startsWith("success")
      ).length;
      const unverifiedCount = exposures.length - verifiedCount;

      res.json({
        run: {
          id: run.id,
          status: run.status,
          marketKeyword: run.marketKeyword,
          brands: run.brands,
          totalExposures: run.totalExposures,
          verifiedCount,
          unverifiedCount,
          errorMessage: run.errorMessage,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
        },
        results: results.map((r) => ({
          brand: r.brand,
          exposureCount: parseInt(r.exposureCount, 10),
          sovPercentage: parseFloat(r.sovPercentage),
        })),
        resultsByType: resultsByType.map((r) => ({
          blockType: r.blockType,
          brand: r.brand,
          exposureCount: parseInt(r.exposureCount, 10),
          totalInType: parseInt(r.totalInType, 10),
          sovPercentage: parseFloat(r.sovPercentage),
        })),
        exposures: exposures.map((e) => ({
          id: e.id,
          blockType: e.blockType,
          title: e.title,
          url: e.url,
          position: parseInt(e.position, 10),
          extractionStatus: e.extractionStatus,
        })),
      });
    } catch (error) {
      console.error("SOV result fetch error:", error);
      res.status(500).json({ message: "결과 조회에 실패했습니다." });
    }
  });

  app.get("/api/sov/runs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!
      const runs = await storage.getSovRunsByUser(userId);

      res.json(runs.map((run) => ({
        id: run.id,
        status: run.status,
        marketKeyword: run.marketKeyword,
        brands: run.brands,
        totalExposures: run.totalExposures,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      })));
    } catch (error) {
      console.error("SOV runs fetch error:", error);
      res.status(500).json({ message: "분석 목록 조회에 실패했습니다." });
    }
  });

  const templateSchema = z.object({
    name: z.string().min(1, "템플릿 이름은 필수입니다").max(50, "템플릿 이름은 50자 이하여야 합니다"),
    marketKeyword: z.string().min(1, "시장 키워드는 필수입니다").max(100, "시장 키워드는 100자 이하여야 합니다"),
    brands: z.array(z.string()).min(1, "최소 1개 브랜드가 필요합니다").max(10, "최대 10개 브랜드까지 가능합니다"),
  });

  app.get("/api/sov/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const templates = await storage.getSovTemplatesByUser(userId);
      res.json(templates);
    } catch (error) {
      console.error("Templates fetch error:", error);
      res.status(500).json({ message: "템플릿 조회에 실패했습니다." });
    }
  });

  app.post("/api/sov/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const validation = validateRequest(templateSchema, req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const template = await storage.createSovTemplate({
        userId,
        ...validation.data,
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Template create error:", error);
      res.status(500).json({ message: "템플릿 생성에 실패했습니다." });
    }
  });

  app.delete("/api/sov/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { id } = req.params;

      const template = await storage.getSovTemplateById(id);
      if (!template) {
        return res.status(404).json({ message: "템플릿을 찾을 수 없습니다." });
      }
      if (template.userId !== userId) {
        return res.status(403).json({ message: "템플릿 삭제 권한이 없습니다." });
      }

      await storage.deleteSovTemplate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Template delete error:", error);
      res.status(500).json({ message: "템플릿 삭제에 실패했습니다." });
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
