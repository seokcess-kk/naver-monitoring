import Redis from "ioredis";

let redisConnection: Redis | null = null;
let redisAvailable: boolean | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("[Redis] Max retries reached, giving up");
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    redisConnection.on("error", (err) => {
      if (redisAvailable !== false) {
        console.error("[Redis] Connection error:", err.message);
        redisAvailable = false;
      }
    });

    redisConnection.on("connect", () => {
      console.log("[Redis] Connected successfully");
      redisAvailable = true;
    });
  }

  return redisConnection;
}

export function isRedisAvailable(): boolean {
  return redisAvailable === true;
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const result = await Promise.race([
      redis.ping(),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error("Redis ping timeout")), 3000)
      ),
    ]);
    redisAvailable = result === "PONG";
    return redisAvailable;
  } catch (error) {
    console.error("[Redis] Health check failed:", (error as Error).message);
    redisAvailable = false;
    return false;
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    try {
      await redisConnection.quit();
    } catch (e) {
      // Ignore errors on close
    }
    redisConnection = null;
    redisAvailable = null;
    console.log("[Redis] Connection closed");
  }
}
