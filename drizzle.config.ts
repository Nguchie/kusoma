import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "[kusoma] DATABASE_DIRECT_URL or DATABASE_URL is required for drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: { url },
});
