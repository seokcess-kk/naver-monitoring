import Bottleneck from "bottleneck";

export const naverAdRateLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 50,
  reservoir: 20,
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 1000,
  highWater: 50,
  strategy: Bottleneck.strategy.OVERFLOW,
});

export async function withRateLimit<T>(
  limiter: Bottleneck,
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new RateLimitTimeoutError("Rate limit queue timeout exceeded"));
    }, timeoutMs);

    limiter.schedule(() => fn())
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export class RateLimitTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitTimeoutError";
  }
}

export const openaiRateLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 100,
  reservoir: 60,
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60000,
});

export const browserlessRateLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 500,
});
