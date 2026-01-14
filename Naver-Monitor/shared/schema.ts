import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_api_keys_user_id").on(table.userId),
]);

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateApiKeySchema = createInsertSchema(apiKeys).pick({
  clientId: true,
  clientSecret: true,
}).partial().refine(
  (data) => data.clientId !== undefined || data.clientSecret !== undefined,
  { message: "clientId 또는 clientSecret 중 하나는 필수입니다" }
);

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type UpdateApiKey = z.infer<typeof updateApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type ApiKeyPublic = {
  clientId: string;
  hasClientSecret: boolean;
  updatedAt: Date | null;
} | null;

// SOV (Share of Voice) 관련 테이블
export const sovRuns = pgTable("sov_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  marketKeyword: text("market_keyword").notNull(),
  brands: text("brands").array().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  totalExposures: varchar("total_exposures").default("0"),
  processedExposures: varchar("processed_exposures").default("0"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_sov_runs_user_id").on(table.userId),
  index("idx_sov_runs_status").on(table.status),
]);

export const sovExposures = pgTable("sov_exposures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => sovRuns.id, { onDelete: "cascade" }),
  blockType: varchar("block_type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  position: varchar("position").notNull(),
  extractedContent: text("extracted_content"),
  extractionStatus: varchar("extraction_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sov_exposures_run_id").on(table.runId),
]);

export const sovScores = pgTable("sov_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exposureId: varchar("exposure_id").notNull().references(() => sovExposures.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  ruleScore: varchar("rule_score").notNull(),
  semanticScore: varchar("semantic_score").notNull(),
  combinedScore: varchar("combined_score").notNull(),
  isRelevant: varchar("is_relevant", { length: 5 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sov_scores_exposure_id").on(table.exposureId),
  index("idx_sov_scores_brand").on(table.brand),
]);

export const sovResults = pgTable("sov_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => sovRuns.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  exposureCount: varchar("exposure_count").notNull(),
  sovPercentage: varchar("sov_percentage").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sov_results_run_id").on(table.runId),
]);

export const sovResultsByType = pgTable("sov_results_by_type", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => sovRuns.id, { onDelete: "cascade" }),
  blockType: varchar("block_type", { length: 50 }).notNull(),
  brand: text("brand").notNull(),
  exposureCount: varchar("exposure_count").notNull(),
  totalInType: varchar("total_in_type").notNull(),
  sovPercentage: varchar("sov_percentage").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sov_results_by_type_run_id").on(table.runId),
  index("idx_sov_results_by_type_block_type").on(table.blockType),
]);

export const sovTemplates = pgTable("sov_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  marketKeyword: text("market_keyword").notNull(),
  brands: text("brands").array().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sov_templates_user_id").on(table.userId),
]);

export const insertSovTemplateSchema = createInsertSchema(sovTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSovTemplate = z.infer<typeof insertSovTemplateSchema>;
export type SovTemplate = typeof sovTemplates.$inferSelect;

export const insertSovRunSchema = createInsertSchema(sovRuns).omit({
  id: true,
  status: true,
  totalExposures: true,
  processedExposures: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
});

export const insertSovExposureSchema = createInsertSchema(sovExposures).omit({
  id: true,
  extractedContent: true,
  extractionStatus: true,
  createdAt: true,
});

export const insertSovScoreSchema = createInsertSchema(sovScores).omit({
  id: true,
  createdAt: true,
});

export const insertSovResultSchema = createInsertSchema(sovResults).omit({
  id: true,
  createdAt: true,
});

export const insertSovResultByTypeSchema = createInsertSchema(sovResultsByType).omit({
  id: true,
  createdAt: true,
});

export type InsertSovRun = z.infer<typeof insertSovRunSchema>;
export type SovRun = typeof sovRuns.$inferSelect;
export type InsertSovExposure = z.infer<typeof insertSovExposureSchema>;
export type SovExposure = typeof sovExposures.$inferSelect;
export type InsertSovScore = z.infer<typeof insertSovScoreSchema>;
export type SovScore = typeof sovScores.$inferSelect;
export type InsertSovResult = z.infer<typeof insertSovResultSchema>;
export type SovResult = typeof sovResults.$inferSelect;
export type InsertSovResultByType = z.infer<typeof insertSovResultByTypeSchema>;
export type SovResultByType = typeof sovResultsByType.$inferSelect;
