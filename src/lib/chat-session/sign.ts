import { createHmac, timingSafeEqual } from "node:crypto";

/** 32-byte session id as 64 hex chars, then HMAC-SHA256 hex. */
const SESSION_ID_HEX = /^[0-9a-f]{64}$/;
const HMAC_HEX = /^[0-9a-f]{64}$/;

export function signSessionId(sessionId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return `${sessionId}.${mac}`;
}

/**
 * Returns the session id if the HMAC matches `secret`.
 * A cookie signed with any other secret (or tampered) returns null.
 */
export function verifySignedSessionId(
  cookieValue: string,
  secret: string,
): string | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;

  const sessionId = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  if (!SESSION_ID_HEX.test(sessionId) || !HMAC_HEX.test(mac)) return null;

  const expected = createHmac("sha256", secret).update(sessionId).digest("hex");
  const actualBuf = Buffer.from(mac, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;

  return sessionId;
}
