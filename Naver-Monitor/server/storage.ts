import { 
  apiKeys, 
  sovRuns, 
  sovExposures, 
  sovScores, 
  sovResults,
  sovTemplates,
  type ApiKey, 
  type InsertApiKey, 
  type UpdateApiKey,
  type SovRun,
  type SovExposure,
  type SovScore,
  type SovResult,
  type SovTemplate,
  type InsertSovTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { encrypt, decrypt, isEncrypted } from "./crypto";

export interface IStorage {
  getApiKeyByUserId(userId: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(userId: string, data: UpdateApiKey): Promise<ApiKey | undefined>;
  deleteApiKey(userId: string): Promise<void>;
  
  getSovRunsByUser(userId: string): Promise<SovRun[]>;
  getSovRun(runId: string): Promise<SovRun | undefined>;
  getSovExposuresByRun(runId: string): Promise<SovExposure[]>;
  getSovScoresByExposure(exposureId: string): Promise<SovScore[]>;
  getSovResultsByRun(runId: string): Promise<SovResult[]>;
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

  async getSovRunsByUser(userId: string): Promise<SovRun[]> {
    return db
      .select()
      .from(sovRuns)
      .where(eq(sovRuns.userId, userId))
      .orderBy(desc(sovRuns.createdAt));
  }

  async getSovRun(runId: string): Promise<SovRun | undefined> {
    const [run] = await db.select().from(sovRuns).where(eq(sovRuns.id, runId));
    return run;
  }

  async getSovExposuresByRun(runId: string): Promise<SovExposure[]> {
    return db.select().from(sovExposures).where(eq(sovExposures.runId, runId));
  }

  async getSovScoresByExposure(exposureId: string): Promise<SovScore[]> {
    return db.select().from(sovScores).where(eq(sovScores.exposureId, exposureId));
  }

  async getSovResultsByRun(runId: string): Promise<SovResult[]> {
    return db.select().from(sovResults).where(eq(sovResults.runId, runId));
  }

  async getSovTemplatesByUser(userId: string): Promise<SovTemplate[]> {
    return db
      .select()
      .from(sovTemplates)
      .where(eq(sovTemplates.userId, userId))
      .orderBy(desc(sovTemplates.createdAt));
  }

  async getSovTemplateById(id: string): Promise<SovTemplate | undefined> {
    const [template] = await db.select().from(sovTemplates).where(eq(sovTemplates.id, id));
    return template;
  }

  async createSovTemplate(data: InsertSovTemplate): Promise<SovTemplate> {
    const [template] = await db.insert(sovTemplates).values(data).returning();
    return template;
  }

  async deleteSovTemplate(id: string): Promise<void> {
    await db.delete(sovTemplates).where(eq(sovTemplates.id, id));
  }
}

export const storage = new DatabaseStorage();
