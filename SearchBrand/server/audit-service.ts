import { db } from "./db";
import { auditLogs, type InsertAuditLog } from "@shared/schema";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";

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
  | "sov_run_delete"
  | "search_log_delete"
  | "update_place_name"
  | "sync_place_names";

export type AuditTargetType = 
  | "user"
  | "api_key"
  | "solution"
  | "user_solution"
  | "sov_run"
  | "search_log"
  | "place_review_job"
  | "place_review_jobs";

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
  const { adminId, action, targetType, startDate, endDate } = params;
  
  const conditions = [];
  
  if (adminId) {
    conditions.push(eq(auditLogs.adminId, adminId));
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
    conditions.push(lte(auditLogs.createdAt, endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause),
  ]);
  
  return {
    logs,
    total: Number(countResult[0]?.count || 0),
    limit,
    offset,
  };
}
