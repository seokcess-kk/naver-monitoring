import Redis from "ioredis";

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      maxRetriesPerRequest: null,
    });

    redisConnection.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });

    redisConnection.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }

  return redisConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    console.log("[Redis] Connection closed");
  }
}
