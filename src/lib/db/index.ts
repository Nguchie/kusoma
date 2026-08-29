import "server-only";

import { env } from "@/lib/env";
import { createDb } from "./client";

const globalForDb = globalThis as unknown as {
  dbBundle: ReturnType<typeof createDb> | undefined;
};

const bundle =
  globalForDb.dbBundle ??
  createDb(env.DATABASE_URL, env.NODE_ENV === "production" ? 10 : 1);

if (env.NODE_ENV !== "production") {
  globalForDb.dbBundle = bundle;
}

export const db = bundle.db;
export type { Db } from "./client";
