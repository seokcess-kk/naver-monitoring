import { 
  apiKeys, 
  searchLogs,
  type ApiKey, 
  type InsertApiKey, 
  type UpdateApiKey,
  type InsertSearchLog,
  type SearchLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { encrypt, decrypt, isEncrypted } from "./crypto";

export interface IStorage {
  getApiKeyByUserId(userId: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(userId: string, data: UpdateApiKey): Promise<ApiKey | undefined>;
  deleteApiKey(userId: string): Promise<void>;
}

function decryptApiKey(apiKey: ApiKey): ApiKey {
  try {
    if (isEncrypted(apiKey.clientSecret)) {
      return {
        ...apiKey,
        clientSecret: decrypt(apiKey.clientSecret),
      };
    }
    return apiKey;
  } catch (error) {
    console.error("[Storage] Failed to decrypt clientSecret:", error);
    return apiKey;
  }
}

export class DatabaseStorage implements IStorage {
  async getApiKeyByUserId(userId: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
    if (!apiKey) return undefined;
    return decryptApiKey(apiKey);
  }

  async createApiKey(data: InsertApiKey): Promise<ApiKey> {
    const encryptedData = {
      ...data,
      clientSecret: encrypt(data.clientSecret),
    };
    const [apiKey] = await db.insert(apiKeys).values(encryptedData).returning();
    return decryptApiKey(apiKey);
  }

  async updateApiKey(userId: string, data: UpdateApiKey): Promise<ApiKey | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (data.clientId !== undefined) {
      updateData.clientId = data.clientId;
    }
    if (data.clientSecret !== undefined) {
      updateData.clientSecret = encrypt(data.clientSecret);
    }
    
    const [apiKey] = await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.userId, userId))
      .returning();
    if (!apiKey) return undefined;
    return decryptApiKey(apiKey);
  }

  async deleteApiKey(userId: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.userId, userId));
  }

  // 검색 로그 관련 메서드
  async createSearchLog(data: InsertSearchLog): Promise<SearchLog> {
    const [log] = await db.insert(searchLogs).values(data).returning();
    return log;
  }

  async getSearchStats(userId: string): Promise<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    byType: { searchType: string; count: number }[];
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchLogs)
      .where(and(eq(searchLogs.userId, userId), gte(searchLogs.createdAt, startOfDay)));

    const [weekResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchLogs)
      .where(and(eq(searchLogs.userId, userId), gte(searchLogs.createdAt, startOfWeek)));

    const [monthResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchLogs)
      .where(and(eq(searchLogs.userId, userId), gte(searchLogs.createdAt, startOfMonth)));

    const byTypeResult = await db
      .select({
        searchType: searchLogs.searchType,
        count: sql<number>`count(*)::int`,
      })
      .from(searchLogs)
      .where(and(eq(searchLogs.userId, userId), gte(searchLogs.createdAt, startOfMonth)))
      .groupBy(searchLogs.searchType);

    return {
      today: todayResult?.count ?? 0,
      thisWeek: weekResult?.count ?? 0,
      thisMonth: monthResult?.count ?? 0,
      byType: byTypeResult,
    };
  }
}

export const storage = new DatabaseStorage();
