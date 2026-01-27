export interface AdminStats {
  users: { total: number; active: number; suspended: number };
  searchLogs: { total: number; unified: number };
  apiKeys: { total: number };
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchLogAdmin {
  id: string;
  userId: string;
  searchType: string;
  keyword: string;
  createdAt: string;
}

export interface AuditLogAdmin {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  adminEmail: string | null;
  createdAt: string;
}

export interface ApiKeyAdmin {
  id: string;
  userId: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SolutionAdmin {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSolutionAdmin {
  id: string;
  solutionId: string;
  solutionCode: string;
  solutionName: string;
  isEnabled: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface UserSolutionAssignment {
  id: string;
  solutionId: string;
  solutionCode: string;
  solutionName: string;
  isEnabled: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface UserActivityInsights {
  activeUsers: { 
    period: number; 
    totalActivities: number;
    breakdown: {
      searches: number;
      placeReviews: number;
    };
  };
  popularKeywords: { keyword: string; count: number }[];
  searchByType: { searchType: string; count: number }[];
  dailySearchTrend: { date: string; count: number }[];
}

export interface PlaceReviewInsights {
  summary: { totalJobs: number; completedJobs: number; totalReviews: number; analyzedReviews: number };
  sentimentDistribution: { sentiment: string; count: number }[];
  popularPlaces: { placeId: string; placeName: string | null; jobCount: number; totalReviews: number }[];
  dailyJobTrend: { date: string; total: number; completed: number }[];
}

export interface SystemPerformanceInsights {
  apiUsage: { totalSearches: number; dailyUsage: { date: string; searches: number }[] };
  placeReviewQueue: { total: number; completed: number; failed: number; pending: number; processing: number; successRate: number };
}

export interface ApiUsageStats {
  byApiType: Array<{
    apiType: string;
    totalCalls: number;
    successRate: number;
    totalTokens: number;
    avgResponseTime: number;
  }>;
  dailyTrend: Array<{
    date: string;
    apiType: string;
    count: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    totalCalls: number;
    totalTokens: number;
  }>;
}

export interface UserUsageStats {
  apiUsage: Array<{
    apiType: string;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    totalTokens: number;
    avgResponseTime: number;
  }>;
  recentActivity: {
    searches: Array<{ id: string; searchType: string; keyword: string; createdAt: string }>;
    placeReviews: Array<{ id: string; placeId: string; placeName: string | null; status: string; createdAt: string }>;
  };
  dailyActivity: Array<{ date: string; count: number }>;
  lastActivityAt: string | null;
}

export interface MissingNameJob {
  id: string;
  placeId: string;
  placeName: string | null;
  status: string;
  createdAt: string;
}

export interface AllServicesStatus {
  overallStatus: string;
  checkedAt: string;
  database: ServiceStatus;
  redis: ServiceStatus;
  chrome: ServiceStatus;
}

export interface ServiceStatus {
  name: string;
  status: string;
  message: string;
  affectedFeatures: string[];
  checkedAt: string;
}

export type DateRangeOption = "today" | "7d" | "30d" | "custom";

export const API_TYPE_LABELS: Record<string, string> = {
  naver_search: "네이버 검색",
  naver_ad: "네이버 광고",
  openai: "OpenAI",
  browserless: "Browserless",
};

export const API_TYPE_COLORS: Record<string, string> = {
  naver_search: "#22c55e",
  naver_ad: "#3b82f6",
  openai: "#8b5cf6",
  browserless: "#f59e0b",
};
