import { logApiUsage } from "./services/api-usage-logger";
import { getAvailableSystemApiKeyForTrend } from "./services/system-api-key-service";

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

export async function isConfigured(): Promise<boolean> {
  const systemKey = await getAvailableSystemApiKeyForTrend();
  return !!systemKey;
}

async function getHeadersWithCredentials(): Promise<{ headers: Record<string, string>; clientId: string } | null> {
  const systemKey = await getAvailableSystemApiKeyForTrend();
  
  if (!systemKey) {
    console.warn("[NaverDataLab] No available system API key for trend");
    return null;
  }

  return {
    headers: {
      "X-Naver-Client-Id": systemKey.clientId,
      "X-Naver-Client-Secret": systemKey.clientSecret,
      "Content-Type": "application/json",
    },
    clientId: systemKey.clientId,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function getKeywordTrend(
  keyword: string,
  userId?: string | null
): Promise<KeywordTrendData | null> {
  const credentials = await getHeadersWithCredentials();
  if (!credentials) {
    console.log("[NaverDataLab] No available system API key, skipping trend fetch");
    return null;
  }

  const { headers, clientId } = credentials;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);

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
      headers,
      body: JSON.stringify(body),
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NaverDataLab] Error response: ${response.status} - ${errorText}`);

      logApiUsage({
        userId,
        clientId,
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
      clientId,
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

    if (trendData.length >= 12) {
      const current = trendData[trendData.length - 1].ratio;
      const yearAgo = trendData[0].ratio;
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
