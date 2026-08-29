import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config();

async function main() {
  const { startWorker } = await import("./start");
  await startWorker(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
