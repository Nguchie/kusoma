import { config } from "dotenv";
import { randomBytes } from "node:crypto";

import {
  signSessionId,
  verifySignedSessionId,
} from "../src/lib/chat-session/sign.ts";

config({ path: ".env.local" });

const secret = process.env.CHAT_SESSION_SECRET?.trim();
if (!secret || secret.length < 32) {
  console.error(
    "[kusoma] CHAT_SESSION_SECRET is missing or shorter than 32 characters.",
  );
  process.exit(1);
}

const sessionId = randomBytes(32).toString("hex");
const valid = signSessionId(sessionId, secret);
const forged = signSessionId(sessionId, "not-the-app-secret-pad-to-32-chars!!");
const tampered = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;

const ok = verifySignedSessionId(valid, secret);
const forgedOk = verifySignedSessionId(forged, secret);
const tamperedOk = verifySignedSessionId(tampered, secret);

if (ok !== sessionId) {
  console.error("[kusoma] Valid cookie failed verification.");
  process.exit(1);
}
if (forgedOk !== null) {
  console.error("[kusoma] Forged cookie (wrong secret) was accepted.");
  process.exit(1);
}
if (tamperedOk !== null) {
  console.error("[kusoma] Tampered cookie was accepted.");
  process.exit(1);
}

console.log("ok: valid cookie verifies; forged cookie is rejected");
