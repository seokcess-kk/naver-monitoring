import { checkRedisConnection, isRedisAvailable } from "../queue/redis";
import { findChromePath } from "../utils/chrome-finder";
import { db } from "../db";
import { sql } from "drizzle-orm";

export interface ServiceStatus {
  name: string;
  status: "ok" | "error" | "unknown";
  message: string;
  checkedAt: string;
  affectedFeatures: string[];
}

export interface AllServicesStatus {
  redis: ServiceStatus;
  chrome: ServiceStatus;
  openai: ServiceStatus;
  database: ServiceStatus;
  overallStatus: "ok" | "degraded" | "error";
  checkedAt: string;
}

let cachedStatus: AllServicesStatus | null = null;
let lastCheckTime: number = 0;
const CACHE_TTL = 30000;

async function checkChromeStatus(): Promise<ServiceStatus> {
  const chromePath = findChromePath();
  const checkedAt = new Date().toISOString();
  
  if (chromePath) {
    return {
      name: "Chrome/Puppeteer",
      status: "ok",
      message: "크롤러 정상 작동 중",
      checkedAt,
      affectedFeatures: [],
    };
  }
  
  return {
    name: "Chrome/Puppeteer",
    status: "error",
    message: "Chrome이 설치되지 않았습니다. 스마트블록 크롤링이 비활성화됩니다.",
    checkedAt,
    affectedFeatures: ["스마트블록 크롤링"],
  };
}

async function checkRedisStatus(): Promise<ServiceStatus> {
  const checkedAt = new Date().toISOString();
  
  try {
    const available = await checkRedisConnection();
    if (available) {
      return {
        name: "Redis",
        status: "ok",
        message: "Redis 연결 정상",
        checkedAt,
        affectedFeatures: [],
      };
    }
  } catch {}
  
  return {
    name: "Redis",
    status: "error",
    message: "Redis에 연결할 수 없습니다. 플레이스 리뷰 분석이 비활성화됩니다.",
    checkedAt,
    affectedFeatures: ["플레이스 리뷰 분석"],
  };
}

async function checkOpenAIStatus(): Promise<ServiceStatus> {
  const checkedAt = new Date().toISOString();
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (apiKey && apiKey.trim().length > 0) {
    return {
      name: "OpenAI",
      status: "ok",
      message: "OpenAI API 키 설정됨",
      checkedAt,
      affectedFeatures: [],
    };
  }
  
  return {
    name: "OpenAI",
    status: "error",
    message: "OPENAI_API_KEY가 설정되지 않았습니다. SOV 분석이 비활성화됩니다.",
    checkedAt,
    affectedFeatures: ["SOV 분석"],
  };
}

const DB_CHECK_TIMEOUT_MS = 3000;

async function checkDatabaseStatus(): Promise<ServiceStatus> {
  const checkedAt = new Date().toISOString();
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl || dbUrl.trim().length === 0) {
    return {
      name: "PostgreSQL",
      status: "error",
      message: "DATABASE_URL이 설정되지 않았습니다.",
      checkedAt,
      affectedFeatures: ["전체 서비스"],
    };
  }
  
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("DB 연결 타임아웃")), DB_CHECK_TIMEOUT_MS);
    });
    
    const queryPromise = db.execute(sql`SELECT 1`);
    
    await Promise.race([queryPromise, timeoutPromise]);
    
    return {
      name: "PostgreSQL",
      status: "ok",
      message: "데이터베이스 연결 정상",
      checkedAt,
      affectedFeatures: [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes("타임아웃");
    
    return {
      name: "PostgreSQL",
      status: "error",
      message: isTimeout 
        ? `데이터베이스 연결 타임아웃 (${DB_CHECK_TIMEOUT_MS / 1000}초 초과)`
        : `데이터베이스 연결 실패: ${errorMessage.substring(0, 100)}`,
      checkedAt,
      affectedFeatures: ["전체 서비스"],
    };
  }
}

export async function getAllServicesStatus(forceRefresh = false): Promise<AllServicesStatus> {
  const now = Date.now();
  
  if (!forceRefresh && cachedStatus && (now - lastCheckTime) < CACHE_TTL) {
    return cachedStatus;
  }
  
  const [redis, chrome, openai, database] = await Promise.all([
    checkRedisStatus(),
    checkChromeStatus(),
    checkOpenAIStatus(),
    checkDatabaseStatus(),
  ]);
  
  const services = [redis, chrome, openai, database];
  const errorCount = services.filter(s => s.status === "error").length;
  
  let overallStatus: "ok" | "degraded" | "error" = "ok";
  if (database.status === "error") {
    overallStatus = "error";
  } else if (errorCount > 0) {
    overallStatus = "degraded";
  }
  
  cachedStatus = {
    redis,
    chrome,
    openai,
    database,
    overallStatus,
    checkedAt: new Date().toISOString(),
  };
  
  lastCheckTime = now;
  return cachedStatus;
}

export function getQuickRedisStatus(): boolean {
  return isRedisAvailable();
}

export function getQuickOpenAIStatus(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return !!(apiKey && apiKey.trim().length > 0);
}

export function getQuickChromeStatus(): boolean {
  return !!findChromePath();
}
