import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { requestIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } from "./middleware/observability";

const isProduction = process.env.NODE_ENV === "production";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isProduction) {
      throw new Error("[FATAL] SESSION_SECRET 환경 변수가 설정되지 않았습니다. 프로덕션에서는 필수입니다.");
    }
    console.warn("[Security] SESSION_SECRET이 설정되지 않았습니다. 개발용 기본값을 사용합니다. 프로덕션에서는 반드시 설정하세요.");
    return "dev-only-session-secret-do-not-use-in-production";
  }
  return secret;
}

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function initializeApp(app: Express, httpServer: Server) {
  const PgSession = connectPgSimple(session);

  app.use(requestIdMiddleware);

  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "sessions",
        createTableIfMissing: true,
      }),
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      name: "naver_monitor_sid",
      proxy: process.env.NODE_ENV === "production",
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.use(requestLoggerMiddleware);

  const SENSITIVE_ROUTES = [
    "/api/auth/",
    "/api/login",
    "/api/register",
    "/api/user",
    "/api/apikeys",
    "/api/admin/users",
    "/api/password",
    "/api/verify",
    "/api/reset",
  ];

  const isSensitiveRoute = (path: string): boolean => {
    return SENSITIVE_ROUTES.some(route => path.startsWith(route) || path.includes(route));
  };

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse && !isSensitiveRoute(path)) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use(errorLoggerMiddleware);
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  log("Application fully initialized and ready to serve requests");
}
