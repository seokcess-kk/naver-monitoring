import axios, { AxiosError } from "axios";
import LRUCache from "lru-cache";
import { logApiUsage } from "./services/api-usage-logger";

export type NaverChannel = "blog" | "cafe" | "kin" | "news";

interface ChannelConfig {
  endpoint: string;
  label: string;
}

const CHANNEL_CONFIG: Record<NaverChannel, ChannelConfig> = {
  blog: { endpoint: "https://openapi.naver.com/v1/search/blog.json", label: "블로그" },
  cafe: { endpoint: "https://openapi.naver.com/v1/search/cafearticle.json", label: "카페" },
  kin: { endpoint: "https://openapi.naver.com/v1/search/kin.json", label: "지식iN" },
  news: { endpoint: "https://openapi.naver.com/v1/search/news.json", label: "뉴스" },
} as const;

export const NAVER_CHANNELS = Object.keys(CHANNEL_CONFIG) as NaverChannel[];

interface NaverApiParams {
  query: string;
  display?: number;
  start?: number;
  sort?: "sim" | "date";
}

interface NaverApiCredentials {
  clientId: string;
  clientSecret: string;
}

const apiCache = new LRUCache<string, unknown>({
  max: 500,
  ttl: 3 * 60 * 1000,
});

function buildCacheKey(endpoint: string, params: NaverApiParams): string {
  return `${endpoint}|${params.query}|${params.sort || "sim"}|${params.start || 1}|${params.display || 10}`;
}

function logApiError(channel: string, error: unknown, query: string): void {
  if (error instanceof AxiosError) {
    console.error(`[NaverAPI] ${channel} 검색 오류:`, {
      query: query.substring(0, 20),
      status: error.response?.status,
      message: error.message,
      code: error.code,
    });
  } else {
    console.error(`[NaverAPI] ${channel} 검색 오류:`, {
      query: query.substring(0, 20),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function callNaverApi(
  endpoint: string,
  params: NaverApiParams,
  credentials: NaverApiCredentials,
  userId?: string | null
) {
  const { query, display = 10, start = 1, sort = "sim" } = params;
  const cacheKey = buildCacheKey(endpoint, { query, display, start, sort });
  
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log(`[NaverAPI] Cache hit: ${query.substring(0, 20)}...`);
    return cached;
  }
  
  const startTime = Date.now();
  try {
    const response = await axios.get(endpoint, {
      params: { query, display, start, sort },
      headers: {
        "X-Naver-Client-Id": credentials.clientId,
        "X-Naver-Client-Secret": credentials.clientSecret,
      },
      timeout: 10000,
    });
    
    const responseTimeMs = Date.now() - startTime;
    logApiUsage({
      userId,
      apiType: "naver_search",
      endpoint,
      success: true,
      responseTimeMs,
      metadata: { query: query.substring(0, 50), display, start },
    });
    
    apiCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    logApiUsage({
      userId,
      apiType: "naver_search",
      endpoint,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs,
      metadata: { query: query.substring(0, 50) },
    });
    throw error;
  }
}

export async function searchChannel(
  channel: NaverChannel,
  params: NaverApiParams,
  credentials: NaverApiCredentials,
  userId?: string | null
) {
  const config = CHANNEL_CONFIG[channel];
  try {
    return await callNaverApi(config.endpoint, params, credentials, userId);
  } catch (error) {
    logApiError(channel, error, params.query);
    throw error;
  }
}

export async function searchBlog(params: NaverApiParams, credentials: NaverApiCredentials, userId?: string | null) {
  return searchChannel("blog", params, credentials, userId);
}

export async function searchCafe(params: NaverApiParams, credentials: NaverApiCredentials, userId?: string | null) {
  return searchChannel("cafe", params, credentials, userId);
}

export async function searchKin(params: NaverApiParams, credentials: NaverApiCredentials, userId?: string | null) {
  return searchChannel("kin", params, credentials, userId);
}

export async function searchNews(params: NaverApiParams, credentials: NaverApiCredentials, userId?: string | null) {
  return searchChannel("news", params, credentials, userId);
}

const EMPTY_RESULT = { total: 0, items: [] };

export async function searchAllChannels(
  query: string,
  sort: "sim" | "date",
  page: number,
  credentials: NaverApiCredentials,
  userId?: string | null
) {
  const display = 10;
  const start = (page - 1) * display + 1;
  const params = { query, display, start, sort };

  const results = await Promise.all(
    NAVER_CHANNELS.map((channel) =>
      searchChannel(channel, params, credentials, userId).catch(() => EMPTY_RESULT)
    )
  );

  return Object.fromEntries(
    NAVER_CHANNELS.map((channel, i) => [channel, results[i]])
  ) as Record<NaverChannel, typeof EMPTY_RESULT>;
}

export async function searchSingleChannel(
  channel: NaverChannel,
  query: string,
  sort: "sim" | "date",
  page: number,
  credentials: NaverApiCredentials,
  userId?: string | null
) {
  const display = 10;
  const start = (page - 1) * display + 1;
  const params = { query, display, start, sort };

  return searchChannel(channel, params, credentials, userId).catch(() => EMPTY_RESULT);
}
