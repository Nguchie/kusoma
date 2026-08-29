export function workerEnv() {
  const redisUrl = process.env.REDIS_URL?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!redisUrl || !databaseUrl) {
    throw new Error(
      "[kusoma] Worker needs REDIS_URL and DATABASE_URL (Guide 4.1). Railway skipped — run locally or on Render later.",
    );
  }
  return {
    REDIS_URL: redisUrl,
    DATABASE_URL: databaseUrl,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.trim(),
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
}
