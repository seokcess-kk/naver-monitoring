import { logApiUsage } from "./services/api-usage-logger";

const NAVER_DATALAB_API_URL = "https://openapi.naver.com/v1/datalab/search";

export interface TrendDataPoint {
  period: string;
  ratio: number;
}

export interface TrendResult {
  keyword: string;
  data: TrendDataPoint[];
}

export interface KeywordTrendData {
  trend: TrendDataPoint[];
  momGrowth: number | null;
  yoyGrowth: number | null;
}

export function isConfigured(): boolean {
  return !!(
    process.env.NAVER_DATALAB_CLIENT_ID &&
    process.env.NAVER_DATALAB_CLIENT_SECRET
  );
}

function getHeaders(): Record<string, string> {
  const clientId = process.env.NAVER_DATALAB_CLIENT_ID;
  const clientSecret = process.env.NAVER_DATALAB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("DataLab API credentials are not configured");
  }

  return {
    "X-Naver-Client-Id": clientId,
    "X-Naver-Client-Secret": clientSecret,
    "Content-Type": "application/json",
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function getKeywordTrend(
  keyword: string,
  userId?: string | null
): Promise<KeywordTrendData | null> {
  if (!isConfigured()) {
    console.log("[NaverDataLab] Credentials not configured, skipping trend fetch");
    return null;
  }

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), 1);
  endDate.setDate(endDate.getDate() - 1);
  
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 13);
  startDate.setDate(1);

  const body = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    timeUnit: "month",
    keywordGroups: [
      {
        groupName: keyword,
        keywords: [keyword],
      },
    ],
  };

  console.log(`[NaverDataLab] Fetching trend for: ${keyword} (${body.startDate} ~ ${body.endDate})`);

  const startTime = Date.now();
  try {
    const response = await fetch(NAVER_DATALAB_API_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NaverDataLab] Error response: ${response.status} - ${errorText}`);

      logApiUsage({
        userId,
        apiType: "naver_datalab",
        endpoint: "/v1/datalab/search",
        success: false,
        errorMessage: `${response.status}: ${errorText.substring(0, 100)}`,
        responseTimeMs,
        metadata: { keyword: keyword.substring(0, 50) },
      });

      return null;
    }

    const data = await response.json();

    logApiUsage({
      userId,
      apiType: "naver_datalab",
      endpoint: "/v1/datalab/search",
      success: true,
      responseTimeMs,
      metadata: { keyword: keyword.substring(0, 50) },
    });

    if (!data.results || data.results.length === 0) {
      console.log(`[NaverDataLab] No trend data for keyword: ${keyword}`);
      return null;
    }

    const trendData: TrendDataPoint[] = data.results[0].data.map((item: any) => ({
      period: item.period,
      ratio: item.ratio,
    }));

    let momGrowth: number | null = null;
    let yoyGrowth: number | null = null;

    if (trendData.length >= 2) {
      const current = trendData[trendData.length - 1].ratio;
      const previous = trendData[trendData.length - 2].ratio;
      if (previous > 0) {
        momGrowth = ((current - previous) / previous) * 100;
      }
    }

    if (trendData.length >= 13) {
      const current = trendData[trendData.length - 1].ratio;
      const yearAgo = trendData[trendData.length - 13].ratio;
      if (yearAgo > 0) {
        yoyGrowth = ((current - yearAgo) / yearAgo) * 100;
      }
    }

    console.log(`[NaverDataLab] Trend result: ${trendData.length} data points, MoM=${momGrowth?.toFixed(1)}%, YoY=${yoyGrowth?.toFixed(1)}%`);

    return {
      trend: trendData,
      momGrowth,
      yoyGrowth,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error("[NaverDataLab] Fetch error:", error);

    logApiUsage({
      userId,
      apiType: "naver_datalab",
      endpoint: "/v1/datalab/search",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs,
      metadata: { keyword: keyword.substring(0, 50) },
    });

    return null;
  }
}

export async function getEstimatedMonthlyVolumes(
  keyword: string,
  currentTotalVolume: number,
  userId?: string | null
): Promise<{ period: string; volume: number }[] | null> {
  const trendData = await getKeywordTrend(keyword, userId);
  
  if (!trendData || trendData.trend.length === 0) {
    return null;
  }

  const lastRatio = trendData.trend[trendData.trend.length - 1].ratio;
  if (lastRatio <= 0) {
    return null;
  }

  const multiplier = currentTotalVolume / lastRatio;

  return trendData.trend.map((point) => ({
    period: point.period,
    volume: Math.round(point.ratio * multiplier),
  }));
}
