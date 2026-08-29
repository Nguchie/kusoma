export const CHAT_SESSION_COOKIE = "kusoma_chat";
export const CHAT_PENDING_COOKIE = "kusoma_chat_pending";

/** 12 hours — Guide Step 2.3. */
export const CHAT_SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Shared-phone picker — Guide Step 2.4. */
export const CHAT_PENDING_TTL_SECONDS = 10 * 60;

export function chatSessionRedisKey(sessionId: string): string {
  return `chat:session:${sessionId}`;
}

export function chatPendingRedisKey(sessionId: string): string {
  return `chat:pending:${sessionId}`;
}
