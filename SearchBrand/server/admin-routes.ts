import { Router, type Response } from "express";
import { db } from "./db";
import { 
  users, 
  apiKeys, 
  sovRuns, 
  sovExposures,
  sovScores,
  searchLogs, 
  solutions, 
  userSolutions,
  placeReviewJobs,
  placeReviewAnalyses,
  placeReviews,
  type UserRole,
  type UserStatus,
} from "@shared/schema";
import { requireAdmin, requireSuperAdmin, type AdminRequest } from "./admin-middleware";
import { logAudit, getAuditLogs } from "./audit-service";
import { desc, eq, and, or, ilike, sql, gte, lte, count, isNull, not } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const paginationSchema = z.object({
  limit: z.string().optional().transform((val) => {
    const num = parseInt(val || "20", 10);
    if (isNaN(num) || num < 1) return 20;
    return Math.min(num, 100);
  }),
  offset: z.string().optional().transform((val) => {
    const num = parseInt(val || "0", 10);
    if (isNaN(num) || num < 0) return 0;
    return num;
  }),
});

function parsePagination(query: Record<string, unknown>): { limit: number; offset: number } {
  const result = paginationSchema.safeParse(query);
  if (result.success) {
    return result.data;
  }
  return { limit: 20, offset: 0 };
}

router.get("/users", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { search, role, status } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    
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
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause),
    ]);
    
    res.json({
      users: userList,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
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
    const { userId, status, startDate, endDate } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    
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
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(sovRuns)
        .where(whereClause),
    ]);
    
    res.json({
      runs,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Admin] Failed to list SOV runs:", error);
    res.status(500).json({ error: "SOV 실행 목록 조회 실패" });
  }
});

router.get("/search-logs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId, searchType, startDate, endDate, keyword } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    
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
    if (keyword && typeof keyword === "string") {
      conditions.push(ilike(searchLogs.keyword, `%${keyword}%`));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(searchLogs)
        .where(whereClause)
        .orderBy(desc(searchLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(searchLogs)
        .where(whereClause),
    ]);
    
    res.json({
      logs,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Admin] Failed to list search logs:", error);
    res.status(500).json({ error: "검색 로그 조회 실패" });
  }
});

router.get("/api-keys", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    
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
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(apiKeys),
    ]);
    
    res.json({
      apiKeys: keys,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
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
    const { adminId, action, targetType, startDate, endDate } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    
    const result = await getAuditLogs({
      adminId: adminId as string,
      action: action as string,
      targetType: targetType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit,
      offset,
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

router.get("/user-solutions/:userId", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const assignments = await db
      .select({
        id: userSolutions.id,
        solutionId: userSolutions.solutionId,
        solutionCode: solutions.code,
        solutionName: solutions.name,
        isEnabled: userSolutions.isEnabled,
        expiresAt: userSolutions.expiresAt,
        createdAt: userSolutions.createdAt,
      })
      .from(userSolutions)
      .innerJoin(solutions, eq(userSolutions.solutionId, solutions.id))
      .where(eq(userSolutions.userId, userId))
      .orderBy(solutions.code);
    
    res.json({ assignments });
  } catch (error) {
    console.error("[Admin] Failed to get user solutions:", error);
    res.status(500).json({ error: "사용자 솔루션 조회 실패" });
  }
});

const assignSolutionSchema = z.object({
  solutionId: z.string().min(1),
  expiresAt: z.string().nullable().optional(),
});

router.post("/user-solutions/:userId", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const adminId = req.adminId!;
    
    const validation = assignSolutionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    
    const { solutionId, expiresAt } = validation.data;
    
    const [existingAssignment] = await db
      .select()
      .from(userSolutions)
      .where(and(
        eq(userSolutions.userId, userId),
        eq(userSolutions.solutionId, solutionId)
      ));
    
    if (existingAssignment) {
      return res.status(409).json({ error: "이미 할당된 솔루션입니다" });
    }
    
    const [solution] = await db
      .select()
      .from(solutions)
      .where(eq(solutions.id, solutionId));
    
    if (!solution) {
      return res.status(404).json({ error: "솔루션을 찾을 수 없습니다" });
    }
    
    const [assignment] = await db
      .insert(userSolutions)
      .values({
        userId,
        solutionId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();
    
    await logAudit({
      adminId,
      action: "user_solution_assign",
      targetType: "user_solution",
      targetId: assignment.id,
      details: { userId, solutionCode: solution.code },
      ipAddress: req.ip,
    });
    
    res.status(201).json({ assignment });
  } catch (error) {
    console.error("[Admin] Failed to assign solution:", error);
    res.status(500).json({ error: "솔루션 할당 실패" });
  }
});

const updateUserSolutionSchema = z.object({
  isEnabled: z.enum(["true", "false"]).optional(),
  expiresAt: z.string().nullable().optional(),
});

router.patch("/user-solutions/:assignmentId", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const adminId = req.adminId!;
    
    const validation = updateUserSolutionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    
    const [existing] = await db
      .select()
      .from(userSolutions)
      .where(eq(userSolutions.id, assignmentId));
    
    if (!existing) {
      return res.status(404).json({ error: "할당 정보를 찾을 수 없습니다" });
    }
    
    const { isEnabled, expiresAt } = validation.data;
    
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    
    await db
      .update(userSolutions)
      .set(updates)
      .where(eq(userSolutions.id, assignmentId));
    
    await logAudit({
      adminId,
      action: "user_solution_update",
      targetType: "user_solution",
      targetId: assignmentId,
      details: validation.data,
      ipAddress: req.ip,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to update user solution:", error);
    res.status(500).json({ error: "솔루션 설정 수정 실패" });
  }
});

router.delete("/user-solutions/:assignmentId", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const adminId = req.adminId!;
    
    const [existing] = await db
      .select({
        id: userSolutions.id,
        userId: userSolutions.userId,
        solutionCode: solutions.code,
      })
      .from(userSolutions)
      .innerJoin(solutions, eq(userSolutions.solutionId, solutions.id))
      .where(eq(userSolutions.id, assignmentId));
    
    if (!existing) {
      return res.status(404).json({ error: "할당 정보를 찾을 수 없습니다" });
    }
    
    await db
      .delete(userSolutions)
      .where(eq(userSolutions.id, assignmentId));
    
    await logAudit({
      adminId,
      action: "user_solution_revoke",
      targetType: "user_solution",
      targetId: assignmentId,
      details: { userId: existing.userId, solutionCode: existing.solutionCode },
      ipAddress: req.ip,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to revoke solution:", error);
    res.status(500).json({ error: "솔루션 해제 실패" });
  }
});

router.get("/insights/user-activity", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyActive] = await db
      .select({ count: sql<number>`count(distinct ${searchLogs.userId})` })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, today));

    const [weeklyActive] = await db
      .select({ count: sql<number>`count(distinct ${searchLogs.userId})` })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, weekAgo));

    const [monthlyActive] = await db
      .select({ count: sql<number>`count(distinct ${searchLogs.userId})` })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, monthAgo));

    const popularKeywords = await db
      .select({
        keyword: searchLogs.keyword,
        count: sql<number>`count(*)::int`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, weekAgo))
      .groupBy(searchLogs.keyword)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const searchByType = await db
      .select({
        searchType: searchLogs.searchType,
        count: sql<number>`count(*)::int`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, weekAgo))
      .groupBy(searchLogs.searchType);

    const dailySearchTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${searchLogs.createdAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, weekAgo))
      .groupBy(sql`date_trunc('day', ${searchLogs.createdAt})`)
      .orderBy(sql`date_trunc('day', ${searchLogs.createdAt})`);

    res.json({
      activeUsers: {
        daily: dailyActive?.count || 0,
        weekly: weeklyActive?.count || 0,
        monthly: monthlyActive?.count || 0,
      },
      popularKeywords,
      searchByType,
      dailySearchTrend,
    });
  } catch (error) {
    console.error("[Admin] Failed to get user activity insights:", error);
    res.status(500).json({ error: "사용자 활동 인사이트 조회 실패" });
  }
});

router.get("/insights/sov-trends", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalRuns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sovRuns);

    const [completedRuns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sovRuns)
      .where(eq(sovRuns.status, "completed"));

    const [failedRuns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sovRuns)
      .where(eq(sovRuns.status, "failed"));

    const recentKeywords = await db
      .select({
        keyword: sovRuns.marketKeyword,
        count: sql<number>`count(*)::int`,
      })
      .from(sovRuns)
      .where(gte(sovRuns.createdAt, weekAgo))
      .groupBy(sovRuns.marketKeyword)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const dailyRunTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${sovRuns.createdAt})::date::text`,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${sovRuns.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${sovRuns.status} = 'failed')::int`,
      })
      .from(sovRuns)
      .where(gte(sovRuns.createdAt, weekAgo))
      .groupBy(sql`date_trunc('day', ${sovRuns.createdAt})`)
      .orderBy(sql`date_trunc('day', ${sovRuns.createdAt})`);

    res.json({
      summary: {
        total: totalRuns?.count || 0,
        completed: completedRuns?.count || 0,
        failed: failedRuns?.count || 0,
        successRate: totalRuns?.count ? Math.round((completedRuns?.count || 0) / totalRuns.count * 100) : 0,
      },
      recentKeywords,
      dailyRunTrend,
    });
  } catch (error) {
    console.error("[Admin] Failed to get SOV trends:", error);
    res.status(500).json({ error: "SOV 트렌드 조회 실패" });
  }
});

router.get("/insights/place-reviews", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs);

    const [completedJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs)
      .where(eq(placeReviewJobs.status, "completed"));

    const [totalReviews] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviews);

    const sentimentDistribution = await db
      .select({
        sentiment: placeReviewAnalyses.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(placeReviewAnalyses)
      .groupBy(placeReviewAnalyses.sentiment);

    const popularPlaces = await db
      .select({
        placeId: placeReviewJobs.placeId,
        placeName: placeReviewJobs.placeName,
        jobCount: sql<number>`count(*)::int`,
        totalReviews: sql<number>`sum(${placeReviewJobs.analyzedReviews}::int)::int`,
      })
      .from(placeReviewJobs)
      .where(eq(placeReviewJobs.status, "completed"))
      .groupBy(placeReviewJobs.placeId, placeReviewJobs.placeName)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const dailyJobTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${placeReviewJobs.createdAt})::date::text`,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${placeReviewJobs.status} = 'completed')::int`,
      })
      .from(placeReviewJobs)
      .where(gte(placeReviewJobs.createdAt, weekAgo))
      .groupBy(sql`date_trunc('day', ${placeReviewJobs.createdAt})`)
      .orderBy(sql`date_trunc('day', ${placeReviewJobs.createdAt})`);

    res.json({
      summary: {
        totalJobs: totalJobs?.count || 0,
        completedJobs: completedJobs?.count || 0,
        totalReviews: totalReviews?.count || 0,
      },
      sentimentDistribution,
      popularPlaces,
      dailyJobTrend,
    });
  } catch (error) {
    console.error("[Admin] Failed to get place review insights:", error);
    res.status(500).json({ error: "플레이스 리뷰 인사이트 조회 실패" });
  }
});

router.get("/insights/system-performance", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalSearches] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, weekAgo));

    const [totalSovRuns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sovRuns)
      .where(gte(sovRuns.createdAt, weekAgo));

    const [completedSovRuns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sovRuns)
      .where(and(gte(sovRuns.createdAt, weekAgo), eq(sovRuns.status, "completed")));

    const [failedSovRuns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sovRuns)
      .where(and(gte(sovRuns.createdAt, weekAgo), eq(sovRuns.status, "failed")));

    const [totalPlaceJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs)
      .where(gte(placeReviewJobs.createdAt, weekAgo));

    const [completedPlaceJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs)
      .where(and(gte(placeReviewJobs.createdAt, weekAgo), eq(placeReviewJobs.status, "completed")));

    const [failedPlaceJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs)
      .where(and(gte(placeReviewJobs.createdAt, weekAgo), eq(placeReviewJobs.status, "failed")));

    const [pendingPlaceJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs)
      .where(eq(placeReviewJobs.status, "pending"));

    const [processingPlaceJobs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(placeReviewJobs)
      .where(eq(placeReviewJobs.status, "processing"));

    const dailyApiUsage = await db
      .select({
        date: sql<string>`date_trunc('day', ${searchLogs.createdAt})::date::text`,
        searches: sql<number>`count(*)::int`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, weekAgo))
      .groupBy(sql`date_trunc('day', ${searchLogs.createdAt})`)
      .orderBy(sql`date_trunc('day', ${searchLogs.createdAt})`);

    const sovSuccessRate = totalSovRuns?.count ? Math.round((completedSovRuns?.count || 0) / totalSovRuns.count * 100) : 0;
    const placeSuccessRate = totalPlaceJobs?.count ? Math.round((completedPlaceJobs?.count || 0) / totalPlaceJobs.count * 100) : 0;

    res.json({
      apiUsage: {
        totalSearches: totalSearches?.count || 0,
        dailyUsage: dailyApiUsage,
      },
      sovQueue: {
        total: totalSovRuns?.count || 0,
        completed: completedSovRuns?.count || 0,
        failed: failedSovRuns?.count || 0,
        successRate: sovSuccessRate,
      },
      placeReviewQueue: {
        total: totalPlaceJobs?.count || 0,
        completed: completedPlaceJobs?.count || 0,
        failed: failedPlaceJobs?.count || 0,
        pending: pendingPlaceJobs?.count || 0,
        processing: processingPlaceJobs?.count || 0,
        successRate: placeSuccessRate,
      },
    });
  } catch (error) {
    console.error("[Admin] Failed to get system performance:", error);
    res.status(500).json({ error: "시스템 성능 조회 실패" });
  }
});

router.get("/export/search-logs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { searchType, startDate, endDate, keyword, userId } = req.query;
    
    const conditions = [];
    
    if (searchType && typeof searchType === "string") {
      conditions.push(eq(searchLogs.searchType, searchType));
    }
    if (startDate && typeof startDate === "string") {
      conditions.push(gte(searchLogs.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === "string") {
      conditions.push(lte(searchLogs.createdAt, new Date(endDate)));
    }
    if (keyword && typeof keyword === "string") {
      conditions.push(ilike(searchLogs.keyword, `%${keyword}%`));
    }
    if (userId && typeof userId === "string") {
      conditions.push(eq(searchLogs.userId, userId));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const logs = await db
      .select()
      .from(searchLogs)
      .where(whereClause)
      .orderBy(desc(searchLogs.createdAt))
      .limit(10000);

    const csvHeader = "ID,키워드,검색타입,사용자ID,생성일시\n";
    const csvBody = logs.map(log => 
      `"${log.id}","${log.keyword.replace(/"/g, '""')}","${log.searchType}","${log.userId}","${new Date(log.createdAt!).toISOString()}"`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="search-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send("\uFEFF" + csvHeader + csvBody);
  } catch (error) {
    console.error("[Admin] Failed to export search logs:", error);
    res.status(500).json({ error: "검색 로그 내보내기 실패" });
  }
});

router.get("/export/sov-runs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const conditions = [];
    
    if (status && typeof status === "string") {
      conditions.push(eq(sovRuns.status, status as any));
    }
    if (startDate && typeof startDate === "string") {
      conditions.push(gte(sovRuns.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === "string") {
      conditions.push(lte(sovRuns.createdAt, new Date(endDate)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const runs = await db
      .select()
      .from(sovRuns)
      .where(whereClause)
      .orderBy(desc(sovRuns.createdAt))
      .limit(10000);

    const csvHeader = "ID,마켓키워드,브랜드,상태,처리노출수,전체노출수,생성일시,완료일시\n";
    const csvBody = runs.map(run => 
      `"${run.id}","${run.marketKeyword.replace(/"/g, '""')}","${run.brands.join(', ').replace(/"/g, '""')}","${run.status}","${run.processedExposures || 0}","${run.totalExposures || 0}","${run.createdAt ? new Date(run.createdAt).toISOString() : ''}","${run.completedAt ? new Date(run.completedAt).toISOString() : ''}"`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sov-runs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send("\uFEFF" + csvHeader + csvBody);
  } catch (error) {
    console.error("[Admin] Failed to export SOV runs:", error);
    res.status(500).json({ error: "SOV 분석 내보내기 실패" });
  }
});

router.get("/export/place-review-jobs", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const conditions = [];
    
    if (status && typeof status === "string") {
      conditions.push(eq(placeReviewJobs.status, status as any));
    }
    if (startDate && typeof startDate === "string") {
      conditions.push(gte(placeReviewJobs.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === "string") {
      conditions.push(lte(placeReviewJobs.createdAt, new Date(endDate)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const jobs = await db
      .select()
      .from(placeReviewJobs)
      .where(whereClause)
      .orderBy(desc(placeReviewJobs.createdAt))
      .limit(10000);

    const csvHeader = "ID,플레이스ID,플레이스명,모드,상태,총리뷰,분석리뷰,생성일시,완료일시\n";
    const csvBody = jobs.map(job => 
      `"${job.id}","${job.placeId}","${(job.placeName || '').replace(/"/g, '""')}","${job.mode}","${job.status}","${job.totalReviews}","${job.analyzedReviews}","${job.createdAt ? new Date(job.createdAt).toISOString() : ''}","${job.completedAt ? new Date(job.completedAt).toISOString() : ''}"`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="place-review-jobs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send("\uFEFF" + csvHeader + csvBody);
  } catch (error) {
    console.error("[Admin] Failed to export place review jobs:", error);
    res.status(500).json({ error: "플레이스 리뷰 내보내기 실패" });
  }
});

// 플레이스명 누락된 작업들 조회
router.get("/place-review-jobs/missing-names", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const jobs = await db
      .select({
        id: placeReviewJobs.id,
        placeId: placeReviewJobs.placeId,
        placeName: placeReviewJobs.placeName,
        status: placeReviewJobs.status,
        createdAt: placeReviewJobs.createdAt,
      })
      .from(placeReviewJobs)
      .where(or(
        isNull(placeReviewJobs.placeName),
        eq(placeReviewJobs.placeName, "")
      ))
      .orderBy(desc(placeReviewJobs.createdAt))
      .limit(100);

    res.json({ jobs, count: jobs.length });
  } catch (error) {
    console.error("[Admin] Failed to get jobs with missing names:", error);
    res.status(500).json({ error: "조회 실패" });
  }
});

// 플레이스명 수동 업데이트
router.patch("/place-review-jobs/:jobId/place-name", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const { placeName } = req.body;

    if (!placeName || typeof placeName !== "string") {
      return res.status(400).json({ error: "플레이스명을 입력해주세요" });
    }

    await db.update(placeReviewJobs)
      .set({ placeName: placeName.trim() })
      .where(eq(placeReviewJobs.id, jobId));

    await logAudit({
      adminId: req.user!.id,
      action: "update_place_name",
      targetType: "place_review_job",
      targetId: jobId,
      details: { placeName },
      ipAddress: req.ip || undefined
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to update place name:", error);
    res.status(500).json({ error: "플레이스명 업데이트 실패" });
  }
});

// 동일 placeId의 다른 작업에서 플레이스명 복사
router.post("/place-review-jobs/sync-place-names", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // 플레이스명이 있는 작업들 조회
    const jobsWithNames = await db
      .select({
        placeId: placeReviewJobs.placeId,
        placeName: placeReviewJobs.placeName,
      })
      .from(placeReviewJobs)
      .where(and(
        not(isNull(placeReviewJobs.placeName)),
        not(eq(placeReviewJobs.placeName, ""))
      ))
      .groupBy(placeReviewJobs.placeId, placeReviewJobs.placeName);

    const placeNameMap: Record<string, string> = {};
    for (const job of jobsWithNames) {
      if (job.placeName && !placeNameMap[job.placeId]) {
        placeNameMap[job.placeId] = job.placeName;
      }
    }

    let updatedCount = 0;
    for (const placeId of Object.keys(placeNameMap)) {
      const placeName = placeNameMap[placeId];
      await db.update(placeReviewJobs)
        .set({ placeName })
        .where(and(
          eq(placeReviewJobs.placeId, placeId),
          or(
            isNull(placeReviewJobs.placeName),
            eq(placeReviewJobs.placeName, "")
          )
        ));
      updatedCount++;
    }

    await logAudit({
      adminId: req.user!.id,
      action: "sync_place_names",
      targetType: "place_review_jobs",
      targetId: undefined,
      details: { updatedPlaceIds: updatedCount },
      ipAddress: req.ip || undefined
    });

    res.json({ success: true, updatedCount });
  } catch (error) {
    console.error("[Admin] Failed to sync place names:", error);
    res.status(500).json({ error: "플레이스명 동기화 실패" });
  }
});

export default router;
