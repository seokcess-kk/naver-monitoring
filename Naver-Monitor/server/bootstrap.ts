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
