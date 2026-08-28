export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("./lib/env");
}
