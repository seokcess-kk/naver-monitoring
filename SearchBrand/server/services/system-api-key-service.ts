import { db } from "../db";
import { systemApiKeys, type SystemApiKey, type InsertSystemApiKey, type UpdateSystemApiKey } from "@shared/schema";
import { eq, asc, and } from "drizzle-orm";
import { encrypt, decrypt, isEncrypted } from "../crypto";
import { getDailyUsage, checkDailyQuota, getTrendDailyUsage, checkTrendDailyQuota, type QuotaStatus } from "./quota-service";

const ROTATION_THRESHOLD = 24000;
const TREND_ROTATION_THRESHOLD = 950;

export interface SystemApiKeyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface SystemApiKeyWithQuota extends SystemApiKey {
  dailyUsage: number;
  quotaStatus: QuotaStatus;
  trendDailyUsage: number;
  trendQuotaStatus: QuotaStatus;
}

function decryptKey(key: SystemApiKey): SystemApiKey {
  try {
    if (isEncrypted(key.clientSecret)) {
      return { ...key, clientSecret: decrypt(key.clientSecret) };
    }
    return key;
  } catch (error) {
    console.error("[SystemApiKey] Failed to decrypt:", error);
    return key;
  }
}

export async function getAllSystemApiKeys(): Promise<SystemApiKey[]> {
  const keys = await db
    .select()
    .from(systemApiKeys)
    .orderBy(asc(systemApiKeys.priority));
  return keys;
}

export async function getActiveSystemApiKeys(): Promise<SystemApiKey[]> {
  const keys = await db
    .select()
    .from(systemApiKeys)
    .where(eq(systemApiKeys.isActive, "true"))
    .orderBy(asc(systemApiKeys.priority));
  return keys.map(decryptKey);
}

export async function getSystemApiKeyById(id: string): Promise<SystemApiKey | undefined> {
  const [key] = await db.select().from(systemApiKeys).where(eq(systemApiKeys.id, id));
  return key;
}

export async function createSystemApiKey(data: InsertSystemApiKey): Promise<SystemApiKey> {
  const encryptedData = {
    ...data,
    clientSecret: encrypt(data.clientSecret),
  };
  const [key] = await db.insert(systemApiKeys).values(encryptedData).returning();
  return key;
}

export async function updateSystemApiKey(id: string, data: UpdateSystemApiKey): Promise<SystemApiKey | undefined> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.clientSecret !== undefined) updateData.clientSecret = encrypt(data.clientSecret);
  if (data.dailyLimit !== undefined) updateData.dailyLimit = data.dailyLimit;
  if (data.trendDailyLimit !== undefined) updateData.trendDailyLimit = data.trendDailyLimit;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  const [key] = await db
    .update(systemApiKeys)
    .set(updateData)
    .where(eq(systemApiKeys.id, id))
    .returning();
  
  return key;
}

export async function deleteSystemApiKey(id: string): Promise<void> {
  await db.delete(systemApiKeys).where(eq(systemApiKeys.id, id));
}

export async function getAvailableSystemApiKey(): Promise<SystemApiKeyCredentials | null> {
  const activeKeys = await getActiveSystemApiKeys();
  
  if (activeKeys.length === 0) {
    console.warn("[SystemApiKey] No active system API keys available");
    return null;
  }
  
  let fallbackKey: SystemApiKey | null = null;
  let fallbackUsage = 0;
  
  for (const key of activeKeys) {
    const dailyLimit = parseInt(key.dailyLimit, 10) || 25000;
    const usage = await getDailyUsage(key.clientId);
    
    if (usage >= dailyLimit) {
      console.log(`[SystemApiKey] Key ${key.name} exhausted (${usage}/${dailyLimit}), trying next...`);
      continue;
    }
    
    if (usage < ROTATION_THRESHOLD) {
      return {
        clientId: key.clientId,
        clientSecret: key.clientSecret,
      };
    }
    
    if (!fallbackKey || usage < fallbackUsage) {
      fallbackKey = key;
      fallbackUsage = usage;
    }
    console.log(`[SystemApiKey] Key ${key.name} at threshold (${usage}/${dailyLimit}), looking for better option...`);
  }
  
  if (fallbackKey) {
    console.log(`[SystemApiKey] Using fallback key ${fallbackKey.name} (${fallbackUsage} used)`);
    return {
      clientId: fallbackKey.clientId,
      clientSecret: fallbackKey.clientSecret,
    };
  }
  
  console.error("[SystemApiKey] All system API keys exhausted");
  return null;
}

export async function getSystemApiKeysWithQuota(): Promise<SystemApiKeyWithQuota[]> {
  const keys = await getAllSystemApiKeys();
  
  const result = await Promise.all(
    keys.map(async (key) => {
      const dailyUsage = await getDailyUsage(key.clientId);
      const quotaStatus = await checkDailyQuota(key.clientId);
      const trendLimit = parseInt(key.trendDailyLimit, 10) || 1000;
      const trendDailyUsage = await getTrendDailyUsage(key.clientId);
      const trendQuotaStatus = await checkTrendDailyQuota(key.clientId, trendLimit);
      return {
        ...key,
        dailyUsage,
        quotaStatus,
        trendDailyUsage,
        trendQuotaStatus,
      };
    })
  );
  
  return result;
}

export async function getSystemQuotaSummary(): Promise<{
  totalKeys: number;
  activeKeys: number;
  totalLimit: number;
  totalUsed: number;
  totalRemaining: number;
  allExhausted: boolean;
  trendTotalLimit: number;
  trendTotalUsed: number;
  trendTotalRemaining: number;
  trendAllExhausted: boolean;
}> {
  const keysWithQuota = await getSystemApiKeysWithQuota();
  const activeKeys = keysWithQuota.filter(k => k.isActive === "true");
  
  const totalLimit = activeKeys.reduce((sum, k) => sum + parseInt(k.dailyLimit, 10), 0);
  const totalUsed = activeKeys.reduce((sum, k) => sum + k.dailyUsage, 0);
  const totalRemaining = Math.max(0, totalLimit - totalUsed);
  const allExhausted = activeKeys.every(k => k.dailyUsage >= parseInt(k.dailyLimit, 10));
  
  const trendTotalLimit = activeKeys.reduce((sum, k) => sum + parseInt(k.trendDailyLimit, 10), 0);
  const trendTotalUsed = activeKeys.reduce((sum, k) => sum + k.trendDailyUsage, 0);
  const trendTotalRemaining = Math.max(0, trendTotalLimit - trendTotalUsed);
  const trendAllExhausted = activeKeys.every(k => k.trendDailyUsage >= parseInt(k.trendDailyLimit, 10));
  
  return {
    totalKeys: keysWithQuota.length,
    activeKeys: activeKeys.length,
    totalLimit,
    totalUsed,
    totalRemaining,
    allExhausted,
    trendTotalLimit,
    trendTotalUsed,
    trendTotalRemaining,
    trendAllExhausted,
  };
}

export async function getAvailableSystemApiKeyForTrend(): Promise<SystemApiKeyCredentials | null> {
  const activeKeys = await getActiveSystemApiKeys();
  
  if (activeKeys.length === 0) {
    console.warn("[SystemApiKey] No active system API keys available for trend");
    return null;
  }
  
  let fallbackKey: SystemApiKey | null = null;
  let fallbackUsage = 0;
  
  for (const key of activeKeys) {
    const trendLimit = parseInt(key.trendDailyLimit, 10) || 1000;
    const usage = await getTrendDailyUsage(key.clientId);
    
    if (usage >= trendLimit) {
      console.log(`[SystemApiKey] Key ${key.name} trend exhausted (${usage}/${trendLimit}), trying next...`);
      continue;
    }
    
    if (usage < TREND_ROTATION_THRESHOLD) {
      return {
        clientId: key.clientId,
        clientSecret: key.clientSecret,
      };
    }
    
    if (!fallbackKey || usage < fallbackUsage) {
      fallbackKey = key;
      fallbackUsage = usage;
    }
    console.log(`[SystemApiKey] Key ${key.name} trend at threshold (${usage}/${trendLimit}), looking for better option...`);
  }
  
  if (fallbackKey) {
    console.log(`[SystemApiKey] Using fallback key ${fallbackKey.name} for trend (${fallbackUsage} used)`);
    return {
      clientId: fallbackKey.clientId,
      clientSecret: fallbackKey.clientSecret,
    };
  }
  
  console.error("[SystemApiKey] All system API keys exhausted for trend");
  return null;
}
