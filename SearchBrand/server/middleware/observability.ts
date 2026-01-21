import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  
  const sensitiveFields = ["clientSecret", "password", "token", "secret", "authorization"];
  const masked: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      masked[key] = "***MASKED***";
    } else if (typeof obj[key] === "object") {
      masked[key] = maskSensitiveData(obj[key]);
    } else {
      masked[key] = obj[key];
    }
  }
  
  return masked;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = crypto.randomUUID().slice(0, 8);
  req.startTime = Date.now();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const { method, path, requestId } = req;
  
  if (path.startsWith("/assets") || path.startsWith("/@") || path.includes(".")) {
    return next();
  }
  
  const userId = (req as any).user?.claims?.sub?.slice(0, 8) || "anon";
  
  res.on("finish", () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const status = res.statusCode;
    const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
    
    console.log(
      `[${level}] [${requestId}] ${method} ${path} ${status} ${duration}ms user=${userId}`
    );
  });
  
  next();
}

export function errorLoggerMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  const { method, path, requestId } = req;
  const userId = (req as any).user?.claims?.sub?.slice(0, 8) || "anon";
  
  console.error(`[ERROR] [${requestId}] ${method} ${path}`, {
    user: userId,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    body: maskSensitiveData(req.body),
  });
  
  next(err);
}
