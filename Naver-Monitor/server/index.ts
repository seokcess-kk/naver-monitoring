import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const port = parseInt(process.env.PORT || "5000", 10);

let isReady = false;
let rootHandler: ((req: Request, res: Response, next: NextFunction) => void) | null = null;

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.head("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/", (req, res, next) => {
  if (!isReady) {
    return res.status(200).send("<!DOCTYPE html><html><head><title>Starting...</title><meta http-equiv='refresh' content='2'></head><body><h1>Application is starting...</h1></body></html>");
  }
  if (rootHandler) {
    return rootHandler(req, res, next);
  }
  next();
});

app.head("/", (_req, res) => {
  res.status(200).send("");
});

app.use((req, res, next) => {
  if (!isReady && req.path !== "/" && req.path !== "/health") {
    return res.status(503).json({ message: "Server is starting up..." });
  }
  next();
});

export function setRootHandler(handler: (req: Request, res: Response, next: NextFunction) => void) {
  rootHandler = handler;
}

httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`Server listening on port ${port} - initializing application...`);
    
    initializeApp().catch((error) => {
      console.error("Failed to initialize application:", error);
      process.exit(1);
    });
  },
);

async function initializeApp() {
  const { pool } = await import("./db");
  
  const session = (await import("express-session")).default;
  const connectPgSimple = (await import("connect-pg-simple")).default;
  const PgSession = connectPgSimple(session);
  
  const { requestIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } = 
    await import("./middleware/observability");

  app.use(requestIdMiddleware);

  app.use(
    express.json({
      verify: (req, _res, buf) => {
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
      secret: process.env.SESSION_SECRET || "naver-monitor-session-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.use(requestLoggerMiddleware);

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
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  app.use(errorLoggerMiddleware);
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  isReady = true;
  log("Application fully initialized and ready to serve requests");
}
