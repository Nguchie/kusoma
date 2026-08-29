import { config } from "dotenv";
import Redis from "ioredis";

config({ path: ".env.local" });

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error("[kusoma] REDIS_URL is missing. Set it in .env.local (Guide Step 2.1).");
  process.exit(1);
}

const redis = new Redis(url, { maxRetriesPerRequest: 1 });

try {
  const pong = await redis.ping();
  console.log(pong);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[kusoma] Redis ping failed:", message);
  process.exitCode = 1;
} finally {
  await redis.quit();
}
