import { db } from "./db";
import { auditLogs, users, type InsertAuditLog } from "@shared/schema";
import { desc, eq, and, gte, lte, sql, ilike } from "drizzle-orm";

export type AuditAction = 
  | "user_status_change"
  | "user_role_change"
  | "api_key_reset"
  | "api_key_delete"
  | "solution_create"
  | "solution_update"
  | "solution_delete"
  | "user_solution_assign"
  | "user_solution_update"
  | "user_solution_revoke"
  | "search_log_delete"
  | "update_place_name"
  | "sync_place_names"
  | "popup.create"
  | "popup.update"
  | "popup.delete";

export type AuditTargetType = 
  | "user"
  | "api_key"
  | "solution"
  | "user_solution"
  | "search_log"
  | "place_review_job"
  | "place_review_jobs"
  | "popup";

interface LogAuditParams {
  adminId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const { adminId, action, targetType, targetId, details, ipAddress } = params;
    
    await db.insert(auditLogs).values({
      adminId,
      action,
      targetType,
      targetId: targetId || null,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    console.error("[Audit] Failed to log audit:", error);
  }
}

interface GetAuditLogsParams {
  adminId?: string;
  adminEmail?: string;
  action?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  const rawLimit = params.limit ?? 50;
  const rawOffset = params.offset ?? 0;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const offset = Math.max(0, rawOffset);
  const { adminId, adminEmail, action, targetType, startDate, endDate } = params;
  
  const conditions = [];
  
  if (adminId) {
    conditions.push(eq(auditLogs.adminId, adminId));
  }
  if (adminEmail) {
    conditions.push(ilike(users.email, `%${adminEmail}%`));
  }
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  if (targetType) {
    conditions.push(eq(auditLogs.targetType, targetType));
  }
  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(auditLogs.createdAt, endOfDay));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [logs, countResult] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        adminId: auditLogs.adminId,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        adminEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.adminId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.adminId, users.id))
      .where(whereClause),
  ]);
  
  return {
    logs,
    total: Number(countResult[0]?.count || 0),
    limit,
    offset,
  };
}
