import crypto from "crypto";
import { logApiUsage } from "./services/api-usage-logger";

const NAVER_AD_API_BASE_URL = "https://api.searchad.naver.com";

interface KeywordVolumeResult {
  keyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
}

function generateSignature(timestamp: number, method: string, path: string): string {
  const secretKey = process.env.NAVER_AD_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NAVER_AD_SECRET_KEY is not configured");
  }
  
  const message = `${timestamp}.${method}.${path}`;
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(message);
  return hmac.digest("base64");
}

function getHeaders(method: string, path: string): Record<string, string> {
  const accessLicense = process.env.NAVER_AD_ACCESS_LICENSE;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  
  if (!accessLicense || !customerId) {
    throw new Error("Naver Ad API credentials are not configured");
  }
  
  const timestamp = Date.now();
  const signature = generateSignature(timestamp, method, path);
  
  return {
    "X-Timestamp": String(timestamp),
    "X-API-KEY": accessLicense,
    "X-Customer": customerId,
    "X-Signature": signature,
    "Content-Type": "application/json",
  };
}

export function isConfigured(): boolean {
  return !!(
    process.env.NAVER_AD_ACCESS_LICENSE &&
    process.env.NAVER_AD_SECRET_KEY &&
    process.env.NAVER_AD_CUSTOMER_ID
  );
}

export async function getKeywordVolume(keyword: string, userId?: string | null): Promise<KeywordVolumeResult | null> {
  if (!isConfigured()) {
    console.log("[NaverAdAPI] Credentials not configured, skipping keyword volume fetch");
    return null;
  }
  
  // 키워드에서 공백 제거 (네이버 광고 API는 공백이 포함된 키워드에서 400 에러 발생할 수 있음)
  const normalizedKeyword = keyword.replace(/\s+/g, "");
  
  const path = "/keywordstool";
  const method = "GET";
  const headers = getHeaders(method, path);
  
  const url = new URL(NAVER_AD_API_BASE_URL + path);
  url.searchParams.set("hintKeywords", normalizedKeyword);
  url.searchParams.set("showDetail", "1");
  
  console.log(`[NaverAdAPI] Fetching keyword volume for: ${keyword} (normalized: ${normalizedKeyword})`);
  
  const startTime = Date.now();
  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
    });
    
    const responseTimeMs = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NaverAdAPI] Error response: ${response.status} - ${errorText}`);
      
      logApiUsage({
        userId,
        apiType: "naver_ad",
        endpoint: path,
        success: false,
        errorMessage: `${response.status}: ${errorText.substring(0, 100)}`,
        responseTimeMs,
        metadata: { keyword: keyword.substring(0, 50) },
      });
      
      throw new Error(`Naver Ad API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    logApiUsage({
      userId,
      apiType: "naver_ad",
      endpoint: path,
      success: true,
      responseTimeMs,
      metadata: { keyword: keyword.substring(0, 50), resultCount: data.keywordList?.length || 0 },
    });
    
    if (!data.keywordList || data.keywordList.length === 0) {
      console.log(`[NaverAdAPI] No data found for keyword: ${keyword}`);
      return null;
    }
    
    const exactMatch = data.keywordList.find(
      (item: any) => item.relKeyword.toLowerCase() === keyword.toLowerCase()
    );
    
    const targetKeyword = exactMatch || data.keywordList[0];
    
    const pcCount = targetKeyword.monthlyPcQcCnt;
    const mobileCount = targetKeyword.monthlyMobileQcCnt;
    
    const result: KeywordVolumeResult = {
      keyword: targetKeyword.relKeyword,
      monthlyPcQcCnt: pcCount === "< 10" ? 5 : Number(pcCount) || 0,
      monthlyMobileQcCnt: mobileCount === "< 10" ? 5 : Number(mobileCount) || 0,
    };
    
    console.log(`[NaverAdAPI] Volume result: PC=${result.monthlyPcQcCnt}, MO=${result.monthlyMobileQcCnt}`);
    
    return result;
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("Naver Ad API error"))) {
      const responseTimeMs = Date.now() - startTime;
      logApiUsage({
        userId,
        apiType: "naver_ad",
        endpoint: path,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs,
        metadata: { keyword: keyword.substring(0, 50) },
      });
    }
    throw error;
  }
}
