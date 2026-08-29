import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDb(url: string, max = 1) {
  const client = postgres(url, {
    prepare: false,
    max,
  });
  return { client, db: drizzle({ client, schema }) };
}

export type Db = ReturnType<typeof createDb>["db"];
