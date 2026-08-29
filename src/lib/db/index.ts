import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  postgres: ReturnType<typeof postgres> | undefined;
};

function createClient() {
  return postgres(env.DATABASE_URL, {
    // Transaction-mode pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: env.NODE_ENV === "production" ? 10 : 1,
  });
}

const client = globalForDb.postgres ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForDb.postgres = client;
}

export const db = drizzle({ client, schema });
