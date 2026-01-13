import axios, { AxiosError } from "axios";
import LRUCache from "lru-cache";

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

interface CachedResult {
  data: any;
  cachedAt: number;
}

const apiCache = new LRUCache<string, CachedResult>({
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
  credentials: NaverApiCredentials
) {
  const { query, display = 10, start = 1, sort = "sim" } = params;
  const cacheKey = buildCacheKey(endpoint, { query, display, start, sort });
  
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log(`[NaverAPI] Cache hit: ${query.substring(0, 20)}...`);
    return cached.data;
  }
  
  const response = await axios.get(endpoint, {
    params: { query, display, start, sort },
    headers: {
      "X-Naver-Client-Id": credentials.clientId,
      "X-Naver-Client-Secret": credentials.clientSecret,
    },
    timeout: 10000,
  });
  
  apiCache.set(cacheKey, { data: response.data, cachedAt: Date.now() });
  return response.data;
}

export async function searchBlog(params: NaverApiParams, credentials: NaverApiCredentials) {
  try {
    return await callNaverApi("https://openapi.naver.com/v1/search/blog.json", params, credentials);
  } catch (error) {
    logApiError("blog", error, params.query);
    throw error;
  }
}

export async function searchCafe(params: NaverApiParams, credentials: NaverApiCredentials) {
  try {
    return await callNaverApi("https://openapi.naver.com/v1/search/cafearticle.json", params, credentials);
  } catch (error) {
    logApiError("cafe", error, params.query);
    throw error;
  }
}

export async function searchKin(params: NaverApiParams, credentials: NaverApiCredentials) {
  try {
    return await callNaverApi("https://openapi.naver.com/v1/search/kin.json", params, credentials);
  } catch (error) {
    logApiError("kin", error, params.query);
    throw error;
  }
}

export async function searchNews(params: NaverApiParams, credentials: NaverApiCredentials) {
  try {
    return await callNaverApi("https://openapi.naver.com/v1/search/news.json", params, credentials);
  } catch (error) {
    logApiError("news", error, params.query);
    throw error;
  }
}

export async function searchAllChannels(
  query: string,
  sort: "sim" | "date",
  page: number,
  credentials: NaverApiCredentials
) {
  const display = 10;
  const start = (page - 1) * display + 1;
  const params = { query, display, start, sort };

  const [blog, cafe, kin, news] = await Promise.all([
    searchBlog(params, credentials).catch(() => ({ total: 0, items: [] })),
    searchCafe(params, credentials).catch(() => ({ total: 0, items: [] })),
    searchKin(params, credentials).catch(() => ({ total: 0, items: [] })),
    searchNews(params, credentials).catch(() => ({ total: 0, items: [] })),
  ]);

  return { blog, cafe, kin, news };
}

export async function searchSingleChannel(
  channel: "blog" | "cafe" | "kin" | "news",
  query: string,
  sort: "sim" | "date",
  page: number,
  credentials: NaverApiCredentials
) {
  const display = 10;
  const start = (page - 1) * display + 1;
  const params = { query, display, start, sort };

  switch (channel) {
    case "blog":
      return searchBlog(params, credentials).catch(() => ({ total: 0, items: [] }));
    case "cafe":
      return searchCafe(params, credentials).catch(() => ({ total: 0, items: [] }));
    case "kin":
      return searchKin(params, credentials).catch(() => ({ total: 0, items: [] }));
    case "news":
      return searchNews(params, credentials).catch(() => ({ total: 0, items: [] }));
    default:
      return { total: 0, items: [] };
  }
}
