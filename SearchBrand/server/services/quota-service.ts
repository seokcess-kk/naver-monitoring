import { db } from "../db";
import { apiUsageLogs } from "@shared/schema";
import { sql, eq, and, gte } from "drizzle-orm";

const DAILY_LIMIT = 25000;
const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.9;

export type QuotaStatusLevel = "ok" | "warning" | "critical" | "exceeded";

export interface QuotaStatus {
  clientId: string;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
  status: QuotaStatusLevel;
  resetAt: string;
  message?: string;
}

export class QuotaExceededError extends Error {
  public quota: QuotaStatus;
  
  constructor(quota: QuotaStatus) {
    super(`일일 API 호출 한도(${quota.limit}회)에 도달했습니다. 내일 다시 시도해주세요.`);
    this.name = "QuotaExceededError";
    this.quota = quota;
  }
}

function getStatusLevel(used: number, limit: number): QuotaStatusLevel {
  const ratio = used / limit;
  if (ratio >= 1) return "exceeded";
  if (ratio >= CRITICAL_THRESHOLD) return "critical";
  if (ratio >= WARNING_THRESHOLD) return "warning";
  return "ok";
}

function getResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function getWarningMessage(status: QuotaStatusLevel, used: number, limit: number): string | undefined {
  switch (status) {
    case "exceeded":
      return `일일 API 호출 한도(${limit.toLocaleString()}회)에 도달했습니다.`;
    case "critical":
      return `일일 API 호출 한도의 90%를 사용했습니다. (${used.toLocaleString()}/${limit.toLocaleString()})`;
    case "warning":
      return `일일 API 호출 한도의 80%를 사용했습니다. (${used.toLocaleString()}/${limit.toLocaleString()})`;
    default:
      return undefined;
  }
}

export async function getDailyUsage(clientId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiUsageLogs)
    .where(
      and(
        eq(apiUsageLogs.clientId, clientId),
        eq(apiUsageLogs.apiType, "naver_search"),
        eq(apiUsageLogs.success, "true"),
        gte(apiUsageLogs.createdAt, today)
      )
    );
  
  return result[0]?.count || 0;
}

export async function checkDailyQuota(clientId: string): Promise<QuotaStatus> {
  const used = await getDailyUsage(clientId);
  const remaining = Math.max(0, DAILY_LIMIT - used);
  const status = getStatusLevel(used, DAILY_LIMIT);
  const allowed = status !== "exceeded";
  const percentageUsed = (used / DAILY_LIMIT) * 100;
  
  return {
    clientId,
    allowed,
    used,
    limit: DAILY_LIMIT,
    remaining,
    percentageUsed: Math.round(percentageUsed * 10) / 10,
    status,
    resetAt: getResetTime(),
    message: getWarningMessage(status, used, DAILY_LIMIT),
  };
}

export async function getMultipleClientQuotas(clientIds: string[]): Promise<Record<string, QuotaStatus>> {
  const quotas: Record<string, QuotaStatus> = {};
  
  await Promise.all(
    clientIds.map(async (clientId) => {
      quotas[clientId] = await checkDailyQuota(clientId);
    })
  );
  
  return quotas;
}
