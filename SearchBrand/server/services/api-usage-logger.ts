import { db } from "../db";
import { apiUsageLogs, type ApiType, type InsertApiUsageLog } from "@shared/schema";

interface ApiUsageLogParams {
  userId?: string | null;
  apiType: ApiType;
  endpoint?: string;
  success?: boolean;
  errorMessage?: string;
  tokensUsed?: number;
  responseTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export async function logApiUsage(params: ApiUsageLogParams): Promise<void> {
  try {
    const logEntry: InsertApiUsageLog = {
      userId: params.userId || null,
      apiType: params.apiType,
      endpoint: params.endpoint || null,
      success: params.success !== false ? "true" : "false",
      errorMessage: params.errorMessage || null,
      tokensUsed: params.tokensUsed?.toString() || null,
      responseTimeMs: params.responseTimeMs?.toString() || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    };

    await db.insert(apiUsageLogs).values(logEntry);
  } catch (error) {
    console.error("[ApiUsageLogger] Failed to log API usage:", error);
  }
}

export async function withApiUsageLogging<T>(
  params: Omit<ApiUsageLogParams, 'success' | 'errorMessage' | 'responseTimeMs'>,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const responseTimeMs = Date.now() - startTime;
    await logApiUsage({
      ...params,
      success: true,
      responseTimeMs,
    });
    return result;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    await logApiUsage({
      ...params,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs,
    });
    throw error;
  }
}
