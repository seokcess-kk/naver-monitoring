import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { pool } from "./db";
import { closeRedisConnection } from "./queue/redis";
import { closePlaceReviewQueue } from "./queue/place-review-queue";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

const SHUTDOWN_TIMEOUT_MS = 10000;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`);
  
  const forceExitTimeout = setTimeout(() => {
    console.error("[Shutdown] Timeout exceeded, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  
  try {
    console.log("[Shutdown] 1/4 Closing HTTP server...");
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log("[Shutdown] HTTP server closed");
    
    console.log("[Shutdown] 2/4 Closing PostgreSQL pool...");
    await pool.end().catch((err) => {
      console.warn("[Shutdown] PostgreSQL pool close error:", err.message);
    });
    console.log("[Shutdown] PostgreSQL pool closed");
    
    console.log("[Shutdown] 3/4 Closing Redis connection...");
    await closeRedisConnection().catch((err) => {
      console.warn("[Shutdown] Redis close error:", err.message);
    });
    console.log("[Shutdown] Redis connection closed");
    
    console.log("[Shutdown] 4/4 Closing BullMQ worker...");
    await closePlaceReviewQueue().catch((err) => {
      console.warn("[Shutdown] BullMQ worker close error:", err.message);
    });
    console.log("[Shutdown] BullMQ worker closed");
    
    clearTimeout(forceExitTimeout);
    console.log("[Shutdown] Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("[Shutdown] Error during shutdown:", error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

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

export function markReady() {
  isReady = true;
}

// Health check endpoints - respond to all methods
app.all("/health", (_req, res) => {
  res.status(200).send("OK");
});

// Root endpoint guard during startup - respond to all methods
app.use((req, res, next) => {
  if (req.path === "/" && !isReady) {
    if (req.method === "GET") {
      return res.status(200).send("<!DOCTYPE html><html><head><title>Starting...</title><meta http-equiv='refresh' content='2'></head><body><h1>Application is starting...</h1></body></html>");
    }
    // HEAD, OPTIONS, etc.
    return res.status(200).send("OK");
  }
  next();
});

httpServer.listen(
  {
    port,
    host: "0.0.0.0",
  },
  () => {
    log(`Server listening on port ${port} - health checks ready`);
    
    setImmediate(async () => {
      try {
        // In production, load the separate app bundle
        // In development, use tsx to load the app module directly
        const appModule = process.env.NODE_ENV === "production"
          ? require("./app.cjs")
          : await import("./app");
        
        await appModule.initializeApp(app, httpServer);
        markReady();
      } catch (error) {
        console.error("Failed to initialize application:", error);
        process.exit(1);
      }
    });
  },
);
