import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, isAuthenticated } from "./auth-routes";
import { searchAllChannels, searchSingleChannel } from "./naver-api";
import { crawlNaverSearch } from "./crawler";
import { insertApiKeySchema, updateApiKeySchema } from "@shared/schema";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { createSovRun, executeSovRun, getSovRun, getSovResultsByRun, getSovExposuresByRun, getSovResultsByTypeForRun } from "./sov-service";
import { getKeywordVolume, isConfigured as isNaverAdConfigured } from "./naver-ad-api";

function normalizeIPv6(ip: string): string {
  if (!ip.includes(":")) return ip;
  
  const parts = ip.split(":");
  if (parts.length < 4) return ip;
  
  return parts.slice(0, 4).join(":") + "::/64";
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return normalizeIPv6(firstIp);
  }
  
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return normalizeIPv6(realIp);
  }
  
  const socketIp = req.ip || req.socket?.remoteAddress;
  if (socketIp) return normalizeIPv6(socketIp);
  
  return "unknown-" + Date.now();
}

function generateRateLimitKey(req: Request): string {
  const authReq = req as any;
  if (authReq.session?.userId) {
    return `user:${authReq.session.userId}`;
  }
  const ip = getClientIp(req);
  return `ip:${ip}`;
}

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!
      const apiKey = await storage.getApiKeyByUserId(userId);
      if (!apiKey) {
        return res.json(null);
      }
      res.json({
        clientId: apiKey.clientId,
        hasClientSecret: !!apiKey.clientSecret,
        updatedAt: apiKey.updatedAt,
      });
    } catch (error) {
      console.error("Get API key error:", error);
      res.status(500).json({ message: "Failed to fetch API key" });
    }
  });

  app.post("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!
      
      const existing = await storage.getApiKeyByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "API key already exists. Use PUT to update." });
      }

      const validated = insertApiKeySchema.parse({
        userId,
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
      });

      const apiKey = await storage.createApiKey(validated);
      res.status(201).json({
        clientId: apiKey.clientId,
        hasClientSecret: !!apiKey.clientSecret,
        updatedAt: apiKey.updatedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create API key error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.put("/api/api-keys", isAuthenticated, apiKeyLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId!

      const validated = updateApiKeySchema.parse({
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
      });

      const apiKey = await storage.updateApiKey(userId, validated);
      if (!apiKey) {
        return res.status(404).json({ message: "API key not found" });
      }
      res.json({
        clientId: apiKey.clientId,
        hasClientSecret: !!apiKey.clientSecret,
        updatedAt: apiKey.updatedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
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
      const userId = req.session.userId!
      
      const parseResult = searchQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "잘못된 입력입니다", 
          errors: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      
      const { keyword, sort, page } = parseResult.data;

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
      const userId = req.session.userId!
      
      const parseResult = channelSearchQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "잘못된 입력입니다", 
          errors: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      
      const { keyword, channel, sort, page } = parseResult.data;

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
      const userId = req.session.userId!
      
      const parseResult = sovRunSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "잘못된 입력입니다", 
          errors: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }

      const { marketKeyword, brands } = parseResult.data;

      const run = await createSovRun(userId, marketKeyword, brands);

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
      const userId = req.session.userId!
      const { runId } = req.params;

      const run = await getSovRun(runId);
      if (!run) {
        return res.status(404).json({ message: "분석 결과를 찾을 수 없습니다." });
      }

      if (run.userId !== userId) {
        return res.status(403).json({ message: "접근 권한이 없습니다." });
      }

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
      const userId = req.session.userId!
      const { runId } = req.params;

      const run = await getSovRun(runId);
      if (!run) {
        return res.status(404).json({ message: "분석 결과를 찾을 수 없습니다." });
      }

      if (run.userId !== userId) {
        return res.status(403).json({ message: "접근 권한이 없습니다." });
      }

      const results = await getSovResultsByRun(runId);
      const exposures = await getSovExposuresByRun(runId);
      const resultsByType = await getSovResultsByTypeForRun(runId);

      res.json({
        run: {
          id: run.id,
          status: run.status,
          marketKeyword: run.marketKeyword,
          brands: run.brands,
          totalExposures: run.totalExposures,
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

      const parseResult = keywordVolumeSchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "잘못된 입력입니다", 
          errors: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }

      const { keyword } = parseResult.data;
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

  return httpServer;
}
