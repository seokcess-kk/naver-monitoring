import type { Request, Response } from "express";
import { z } from "zod";
import { getSovRun } from "../sov-service";

export function normalizeIPv6(ip: string): string {
  if (!ip.includes(":")) return ip;
  
  const parts = ip.split(":");
  if (parts.length < 4) return ip;
  
  return parts.slice(0, 4).join(":") + "::/64";
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return normalizeIPv6(firstIp);
  }
  
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return normalizeIPv6(realIp);
  }
  
  const socketIp = req.ip || req.socket?.remoteAddress;
  if (socketIp) return normalizeIPv6(socketIp);
  
  return "unknown";
}

export function generateRateLimitKey(req: Request): string {
  const authReq = req as any;
  if (authReq.session?.userId) {
    return `user:${authReq.session.userId}`;
  }
  const ip = getClientIp(req);
  return `ip:${ip}`;
}

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationFailure = {
  success: false;
  error: {
    message: string;
    errors: Array<{ field: string; message: string }>;
  };
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      message: "입력 값이 올바르지 않습니다",
      errors: result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    },
  };
}

export function sendValidationError(res: Response, validation: ValidationFailure) {
  return res.status(400).json(validation.error);
}

type SovRunType = NonNullable<Awaited<ReturnType<typeof getSovRun>>>;

type SovRunAccessSuccess = {
  success: true;
  run: SovRunType;
};

type SovRunAccessFailure = {
  success: false;
  status: number;
  message: string;
};

type SovRunAccessResult = SovRunAccessSuccess | SovRunAccessFailure;

export async function assertSovRunAccessible(
  runId: string,
  userId: string
): Promise<SovRunAccessResult> {
  const run = await getSovRun(runId);
  
  if (!run) {
    return { success: false, status: 404, message: "분석 결과를 찾을 수 없습니다." };
  }
  
  if (run.userId !== userId) {
    return { success: false, status: 403, message: "접근 권한이 없습니다." };
  }
  
  return { success: true, run };
}

export interface ApiKeyPublic {
  clientId: string;
  hasClientSecret: boolean;
  updatedAt: Date | null;
}

export function toApiKeyPublic(apiKey: {
  clientId: string;
  clientSecret: string | null;
  updatedAt: Date | null;
}): ApiKeyPublic {
  return {
    clientId: apiKey.clientId,
    hasClientSecret: !!apiKey.clientSecret,
    updatedAt: apiKey.updatedAt,
  };
}
