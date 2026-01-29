import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "./models/auth";
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

// 시스템 공용 API 키 (관리자 전용)
export const systemApiKeys = pgTable("system_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret").notNull(),
  dailyLimit: varchar("daily_limit").default("25000").notNull(),
  trendDailyLimit: varchar("trend_daily_limit").default("1000").notNull(),
  priority: varchar("priority").default("0").notNull(),
  isActive: varchar("is_active", { length: 5 }).default("true").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_system_api_keys_is_active").on(table.isActive),
  index("idx_system_api_keys_priority").on(table.priority),
]);

export const insertSystemApiKeySchema = createInsertSchema(systemApiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSystemApiKeySchema = createInsertSchema(systemApiKeys).pick({
  name: true,
  clientId: true,
  clientSecret: true,
  dailyLimit: true,
  trendDailyLimit: true,
  priority: true,
  isActive: true,
}).partial();

export type InsertSystemApiKey = z.infer<typeof insertSystemApiKeySchema>;
export type UpdateSystemApiKey = z.infer<typeof updateSystemApiKeySchema>;
export type SystemApiKey = typeof systemApiKeys.$inferSelect;

// SOV (Share of Voice) 관련 테이블
export const sovRuns = pgTable("sov_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  marketKeyword: text("market_keyword").notNull(),
  brands: text("brands").array().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  statusMessage: text("status_message"),
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
  needsReview: varchar("needs_review", { length: 5 }).default("false"),
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

// 검색 로그 테이블 (사용량 추적용)
export const searchLogs = pgTable("search_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  searchType: varchar("search_type", { length: 20 }).notNull(), // 'unified' | 'blog' | 'cafe' | 'kin' | 'news'
  keyword: text("keyword").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_search_logs_user_id").on(table.userId),
  index("idx_search_logs_created_at").on(table.createdAt),
  index("idx_search_logs_user_created").on(table.userId, table.createdAt),
]);

export const insertSearchLogSchema = createInsertSchema(searchLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertSearchLog = z.infer<typeof insertSearchLogSchema>;
export type SearchLog = typeof searchLogs.$inferSelect;

// 솔루션(기능 모듈) 관리 테이블
export const solutions = pgTable("solutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: varchar("is_active", { length: 5 }).default("true").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_solutions_code").on(table.code),
  index("idx_solutions_is_active").on(table.isActive),
]);

export const userSolutions = pgTable("user_solutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  solutionId: varchar("solution_id").notNull().references(() => solutions.id, { onDelete: "cascade" }),
  isEnabled: varchar("is_enabled", { length: 5 }).default("true").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_solutions_user_id").on(table.userId),
  index("idx_user_solutions_solution_id").on(table.solutionId),
]);

// 관리자 감사 로그 테이블
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: varchar("target_id"),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_admin_id").on(table.adminId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_target_type").on(table.targetType),
  index("idx_audit_logs_created_at").on(table.createdAt),
]);

export const insertSolutionSchema = createInsertSchema(solutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSolutionSchema = createInsertSchema(userSolutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertSolution = z.infer<typeof insertSolutionSchema>;
export type Solution = typeof solutions.$inferSelect;
export type InsertUserSolution = z.infer<typeof insertUserSolutionSchema>;
export type UserSolution = typeof userSolutions.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// User role types
export type UserRole = "user" | "admin" | "superadmin";
export type UserStatus = "active" | "suspended" | "pending";

// Place Review Analysis 테이블
export const placeReviewJobs = pgTable("place_review_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  placeId: varchar("place_id", { length: 50 }).notNull(),
  placeName: text("place_name"),
  mode: varchar("mode", { length: 20 }).notNull().default("QTY"),
  limitQty: varchar("limit_qty"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  statusMessage: text("status_message"),
  progress: varchar("progress").default("0"),
  totalReviews: varchar("total_reviews").default("0"),
  analyzedReviews: varchar("analyzed_reviews").default("0"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_place_review_jobs_user_id").on(table.userId),
  index("idx_place_review_jobs_status").on(table.status),
  index("idx_place_review_jobs_place_id").on(table.placeId),
]);

export const placeReviews = pgTable("place_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => placeReviewJobs.id, { onDelete: "cascade" }),
  reviewText: text("review_text").notNull(),
  reviewDate: timestamp("review_date").notNull(),
  authorName: text("author_name"),
  rating: varchar("rating", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_place_reviews_job_id").on(table.jobId),
  index("idx_place_reviews_review_date").on(table.reviewDate),
]);

export const placeReviewAnalyses = pgTable("place_review_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").notNull().references(() => placeReviews.id, { onDelete: "cascade" }),
  sentiment: varchar("sentiment", { length: 20 }).notNull(),
  aspects: text("aspects").notNull().default("[]"),
  keywords: text("keywords").notNull().default("[]"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_place_review_analyses_review_id").on(table.reviewId),
  index("idx_place_review_analyses_sentiment").on(table.sentiment),
]);

export const insertPlaceReviewJobSchema = createInsertSchema(placeReviewJobs).omit({
  id: true,
  placeName: true,
  status: true,
  statusMessage: true,
  progress: true,
  totalReviews: true,
  analyzedReviews: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
});

export const insertPlaceReviewSchema = createInsertSchema(placeReviews).omit({
  id: true,
  createdAt: true,
});

export const insertPlaceReviewAnalysisSchema = createInsertSchema(placeReviewAnalyses).omit({
  id: true,
  createdAt: true,
});

export type InsertPlaceReviewJob = z.infer<typeof insertPlaceReviewJobSchema>;
export type PlaceReviewJob = typeof placeReviewJobs.$inferSelect;
export type InsertPlaceReview = z.infer<typeof insertPlaceReviewSchema>;
export type PlaceReview = typeof placeReviews.$inferSelect;
export type InsertPlaceReviewAnalysis = z.infer<typeof insertPlaceReviewAnalysisSchema>;
export type PlaceReviewAnalysis = typeof placeReviewAnalyses.$inferSelect;

export type PlaceReviewMode = "QTY" | "DATE" | "DATE_RANGE";

// API 사용량 로그 테이블
export const apiUsageLogs = pgTable("api_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  clientId: varchar("client_id", { length: 100 }), // 네이버 API Client ID (quota 추적용)
  apiType: varchar("api_type", { length: 30 }).notNull(), // 'naver_search' | 'naver_ad' | 'openai' | 'browserless'
  endpoint: text("endpoint"), // API 엔드포인트 또는 작업 설명
  success: varchar("success", { length: 5 }).notNull().default("true"), // 'true' | 'false'
  errorMessage: text("error_message"),
  tokensUsed: varchar("tokens_used"), // OpenAI 토큰 사용량
  responseTimeMs: varchar("response_time_ms"), // 응답 시간 (밀리초)
  metadata: text("metadata"), // 추가 정보 (JSON)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_api_usage_logs_user_id").on(table.userId),
  index("idx_api_usage_logs_client_id").on(table.clientId),
  index("idx_api_usage_logs_api_type").on(table.apiType),
  index("idx_api_usage_logs_created_at").on(table.createdAt),
  index("idx_api_usage_logs_success").on(table.success),
]);

export const insertApiUsageLogSchema = createInsertSchema(apiUsageLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;

export type ApiType = "naver_search" | "naver_ad" | "naver_datalab" | "openai" | "browserless";

// 사용자 피드백 테이블
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  category: varchar("category", { length: 20 }).notNull(), // 'feature' | 'inquiry' | 'bug'
  content: text("content").notNull(),
  screenshotUrl: text("screenshot_url"),
  pageUrl: text("page_url"),
  userAgent: text("user_agent"),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending' | 'in_progress' | 'resolved'
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_feedback_user_id").on(table.userId),
  index("idx_feedback_category").on(table.category),
  index("idx_feedback_status").on(table.status),
  index("idx_feedback_created_at").on(table.createdAt),
]);

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  adminNote: true,
  status: true,
});

export const updateFeedbackSchema = createInsertSchema(feedback).pick({
  status: true,
  adminNote: true,
}).partial();

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type UpdateFeedback = z.infer<typeof updateFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type FeedbackCategory = "feature" | "inquiry" | "bug";
export type FeedbackStatus = "pending" | "in_progress" | "resolved";
