import { jsonError } from "@/server/http";

/** Daraja is out of scope (Guide 4.6 / system design §15). */
export async function POST() {
  return jsonError("M-Pesa webhooks are not enabled in this build.", 501);
}

export async function GET() {
  return jsonError("M-Pesa webhooks are not enabled in this build.", 501);
}
