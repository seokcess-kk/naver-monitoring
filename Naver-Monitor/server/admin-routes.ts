import { Router, type Response } from "express";
import { db } from "./db";
import { 
  users, 
  apiKeys, 
  sovRuns, 
  sovExposures,
  searchLogs, 
  solutions, 
  userSolutions,
  type UserRole,
  type UserStatus,
} from "@shared/schema";
import { requireAdmin, requireSuperAdmin, type AdminRequest } from "./admin-middleware";
import { logAudit, getAuditLogs } from "./audit-service";
import { desc, eq, and, ilike, sql, gte, lte, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/users", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { 
      search, 
      role, 
      status, 
      limit = "20", 
      offset = "0" 
    } = req.query;
    
    const conditions = [];
    
    if (search && typeof search === "string") {
      conditions.push(ilike(users.email, `%${search}%`));
    }
    if (role && typeof role === "string") {
      conditions.push(eq(users.role, role));
    }
    if (status && typeof status === "string") {
      conditions.push(eq(users.status, status));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [userList, countResult] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          status: users.status,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause),
    ]);
    
    res.json({
      users: userList,
      total: Number(countResult[0]?.count || 0),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("[Admin] Failed to list users:", error);
    res.status(500).json({ error: "사용자 목록 조회 실패" });
  }
});

router.get("/users/:userId", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        status: users.status,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }
    
    const [apiKeyInfo] = await db
      .select({
        hasKey: sql<boolean>`true`,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .limit(1);
    
    const [sovStats] = await db
      .select({ 
        count: sql<number>`count(*)`,
      })
      .from(sovRuns)
      .where(eq(sovRuns.userId, userId));
    
    const [searchStats] = await db
      .select({ 
        count: sql<number>`count(*)`,
      })
      .from(searchLogs)
      .where(eq(searchLogs.userId, userId));
    
    res.json({
      user,
      stats: {
        hasApiKey: !!apiKeyInfo,
        apiKeyUpdatedAt: apiKeyInfo?.updatedAt || null,
        sovRunCount: Number(sovStats?.count || 0),
        searchCount: Number(searchStats?.count || 0),
      },
    });
  } catch (error) {
    console.error("[Admin] Failed to get user:", error);
    res.status(500).json({ error: "사용자 조회 실패" });
  }
});

const updateUserSchema = z.object({
  role: z.enum(["user", "admin", "superadmin"]).optional(),
  status: z.enum(["active", "suspended", "pending"]).optional(),
});

router.patch("/users/:userId", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const adminId = req.adminId!;
    const adminUser = req.user!;
    
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    
    const { role, status } = validation.data;
    
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!targetUser) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }
    
    if (role && adminUser.role !== "superadmin") {
      return res.status(403).json({ error: "역할 변경은 슈퍼 관리자만 가능합니다" });
    }
    
    if (targetUser.role === "superadmin" && adminUser.role !== "superadmin") {
      return res.status(403).json({ error: "슈퍼 관리자 수정 권한이 없습니다" });
    }
    
    const updates: Partial<{ role: string; status: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    
    if (role) updates.role = role;
    if (status) updates.status = status;
    
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId));
    
    if (role && role !== targetUser.role) {
      await logAudit({
        adminId,
        action: "user_role_change",
        targetType: "user",
        targetId: userId,
        details: { oldRole: targetUser.role, newRole: role },
        ipAddress: req.ip,
      });
    }
    
    if (status && status !== targetUser.status) {
      await logAudit({
        adminId,
        action: "user_status_change",
        targetType: "user",
        targetId: userId,
        details: { oldStatus: targetUser.status, newStatus: status },
        ipAddress: req.ip,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to update user:", error);
    res.status(500).json({ error: "사용자 수정 실패" });
  }
});

router.get("/sov-runs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { 
      userId, 
      status, 
      startDate, 
      endDate,
      limit = "20", 
      offset = "0" 
    } = req.query;
    
    const conditions = [];
    
    if (userId && typeof userId === "string") {
      conditions.push(eq(sovRuns.userId, userId));
    }
    if (status && typeof status === "string") {
      conditions.push(eq(sovRuns.status, status));
    }
    if (startDate && typeof startDate === "string") {
      conditions.push(gte(sovRuns.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === "string") {
      conditions.push(lte(sovRuns.createdAt, new Date(endDate)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [runs, countResult] = await Promise.all([
      db
        .select({
          id: sovRuns.id,
          userId: sovRuns.userId,
          marketKeyword: sovRuns.marketKeyword,
          brands: sovRuns.brands,
          status: sovRuns.status,
          totalExposures: sovRuns.totalExposures,
          processedExposures: sovRuns.processedExposures,
          errorMessage: sovRuns.errorMessage,
          createdAt: sovRuns.createdAt,
          completedAt: sovRuns.completedAt,
        })
        .from(sovRuns)
        .where(whereClause)
        .orderBy(desc(sovRuns.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(sovRuns)
        .where(whereClause),
    ]);
    
    res.json({
      runs,
      total: Number(countResult[0]?.count || 0),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("[Admin] Failed to list SOV runs:", error);
    res.status(500).json({ error: "SOV 실행 목록 조회 실패" });
  }
});

router.get("/search-logs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { 
      userId, 
      searchType,
      startDate, 
      endDate,
      limit = "50", 
      offset = "0" 
    } = req.query;
    
    const conditions = [];
    
    if (userId && typeof userId === "string") {
      conditions.push(eq(searchLogs.userId, userId));
    }
    if (searchType && typeof searchType === "string") {
      conditions.push(eq(searchLogs.searchType, searchType));
    }
    if (startDate && typeof startDate === "string") {
      conditions.push(gte(searchLogs.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === "string") {
      conditions.push(lte(searchLogs.createdAt, new Date(endDate)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(searchLogs)
        .where(whereClause)
        .orderBy(desc(searchLogs.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(searchLogs)
        .where(whereClause),
    ]);
    
    res.json({
      logs,
      total: Number(countResult[0]?.count || 0),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("[Admin] Failed to list search logs:", error);
    res.status(500).json({ error: "검색 로그 조회 실패" });
  }
});

router.get("/api-keys", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { limit = "20", offset = "0" } = req.query;
    
    const [keys, countResult] = await Promise.all([
      db
        .select({
          id: apiKeys.id,
          userId: apiKeys.userId,
          clientId: apiKeys.clientId,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .orderBy(desc(apiKeys.updatedAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(apiKeys),
    ]);
    
    res.json({
      apiKeys: keys,
      total: Number(countResult[0]?.count || 0),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("[Admin] Failed to list API keys:", error);
    res.status(500).json({ error: "API 키 목록 조회 실패" });
  }
});

router.delete("/api-keys/:keyId", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { keyId } = req.params;
    const adminId = req.adminId!;
    
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));
    
    if (!key) {
      return res.status(404).json({ error: "API 키를 찾을 수 없습니다" });
    }
    
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    
    await logAudit({
      adminId,
      action: "api_key_delete",
      targetType: "api_key",
      targetId: keyId,
      details: { userId: key.userId },
      ipAddress: req.ip,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to delete API key:", error);
    res.status(500).json({ error: "API 키 삭제 실패" });
  }
});

router.get("/audit-logs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { 
      adminId, 
      action, 
      targetType, 
      startDate, 
      endDate,
      limit = "50", 
      offset = "0" 
    } = req.query;
    
    const result = await getAuditLogs({
      adminId: adminId as string,
      action: action as string,
      targetType: targetType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
    
    res.json(result);
  } catch (error) {
    console.error("[Admin] Failed to list audit logs:", error);
    res.status(500).json({ error: "감사 로그 조회 실패" });
  }
});

router.get("/stats/overview", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const [userStats, sovStats, searchStats, apiKeyStats] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where status = 'active')`,
          suspended: sql<number>`count(*) filter (where status = 'suspended')`,
        })
        .from(users),
      db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where status = 'completed')`,
          failed: sql<number>`count(*) filter (where status = 'failed')`,
          pending: sql<number>`count(*) filter (where status IN ('pending', 'collecting', 'extracting', 'scoring'))`,
        })
        .from(sovRuns),
      db
        .select({
          total: sql<number>`count(*)`,
          unified: sql<number>`count(*) filter (where search_type = 'unified')`,
          sov: sql<number>`count(*) filter (where search_type = 'sov')`,
        })
        .from(searchLogs),
      db
        .select({ total: sql<number>`count(*)` })
        .from(apiKeys),
    ]);
    
    res.json({
      users: {
        total: Number(userStats[0]?.total || 0),
        active: Number(userStats[0]?.active || 0),
        suspended: Number(userStats[0]?.suspended || 0),
      },
      sovRuns: {
        total: Number(sovStats[0]?.total || 0),
        completed: Number(sovStats[0]?.completed || 0),
        failed: Number(sovStats[0]?.failed || 0),
        pending: Number(sovStats[0]?.pending || 0),
      },
      searchLogs: {
        total: Number(searchStats[0]?.total || 0),
        unified: Number(searchStats[0]?.unified || 0),
        sov: Number(searchStats[0]?.sov || 0),
      },
      apiKeys: {
        total: Number(apiKeyStats[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("[Admin] Failed to get stats:", error);
    res.status(500).json({ error: "통계 조회 실패" });
  }
});

router.get("/solutions", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const solutionList = await db
      .select()
      .from(solutions)
      .orderBy(solutions.code);
    
    res.json({ solutions: solutionList });
  } catch (error) {
    console.error("[Admin] Failed to list solutions:", error);
    res.status(500).json({ error: "솔루션 목록 조회 실패" });
  }
});

const createSolutionSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post("/solutions", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminId = req.adminId!;
    const validation = createSolutionSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    
    const { code, name, description } = validation.data;
    
    const [existing] = await db
      .select()
      .from(solutions)
      .where(eq(solutions.code, code));
    
    if (existing) {
      return res.status(409).json({ error: "이미 존재하는 솔루션 코드입니다" });
    }
    
    const [newSolution] = await db
      .insert(solutions)
      .values({ code, name, description })
      .returning();
    
    await logAudit({
      adminId,
      action: "solution_create",
      targetType: "solution",
      targetId: newSolution.id,
      details: { code, name },
      ipAddress: req.ip,
    });
    
    res.status(201).json({ solution: newSolution });
  } catch (error) {
    console.error("[Admin] Failed to create solution:", error);
    res.status(500).json({ error: "솔루션 생성 실패" });
  }
});

router.patch("/solutions/:solutionId", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { solutionId } = req.params;
    const adminId = req.adminId!;
    
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isActive: z.enum(["true", "false"]).optional(),
    });
    
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    
    const [existing] = await db
      .select()
      .from(solutions)
      .where(eq(solutions.id, solutionId));
    
    if (!existing) {
      return res.status(404).json({ error: "솔루션을 찾을 수 없습니다" });
    }
    
    const updates = {
      ...validation.data,
      updatedAt: new Date(),
    };
    
    await db
      .update(solutions)
      .set(updates)
      .where(eq(solutions.id, solutionId));
    
    await logAudit({
      adminId,
      action: "solution_update",
      targetType: "solution",
      targetId: solutionId,
      details: validation.data,
      ipAddress: req.ip,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to update solution:", error);
    res.status(500).json({ error: "솔루션 수정 실패" });
  }
});

export default router;
