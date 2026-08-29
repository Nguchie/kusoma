import "server-only";

import Redis from "ioredis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export function getRedis(): Redis {
  if (!env.REDIS_URL) {
    throw new Error(
      "[kusoma] REDIS_URL is required (Guide Step 2.1). Use redis://127.0.0.1:6379 locally or an Upstash URL.",
    );
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  return globalForRedis.redis;
}

export async function redisPing(): Promise<string> {
  return getRedis().ping();
}
