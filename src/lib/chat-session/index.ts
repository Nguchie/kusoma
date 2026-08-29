import "server-only";

import { randomBytes } from "node:crypto";

import {
  CHAT_PENDING_COOKIE,
  CHAT_PENDING_TTL_SECONDS,
  CHAT_SESSION_COOKIE,
  CHAT_SESSION_TTL_SECONDS,
} from "@/lib/chat-session/constants";
import {
  clearChatCookie,
  readSignedChatCookie,
  setSignedChatCookie,
} from "@/lib/chat-session/cookie";
import {
  deleteChatSession,
  deletePendingSelection,
  loadChatSession,
  loadPendingSelection,
  saveChatSession,
  savePendingSelection,
} from "@/lib/chat-session/store";
import type {
  ChatPendingPayload,
  ChatSessionPayload,
} from "@/lib/chat-session/types";
import { normalizeKenyaPhone } from "@/lib/phone";

export {
  CHAT_PENDING_COOKIE,
  CHAT_PENDING_TTL_SECONDS,
  CHAT_SESSION_COOKIE,
  CHAT_SESSION_TTL_SECONDS,
} from "@/lib/chat-session/constants";
export { signSessionId, verifySignedSessionId } from "@/lib/chat-session/sign";
export type {
  ChatPendingPayload,
  ChatSessionPayload,
} from "@/lib/chat-session/types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newSessionId(): string {
  return randomBytes(32).toString("hex");
}

function expiresAtIso(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export async function createChatSession(input: {
  studentId: string;
  phone: string;
}): Promise<ChatSessionPayload> {
  if (!UUID.test(input.studentId)) {
    throw new Error("[kusoma] Chat session studentId must be a UUID.");
  }

  const phone = normalizeKenyaPhone(input.phone);
  if (!phone) {
    throw new Error("[kusoma] Chat session phone is not a valid Kenyan number.");
  }

  const sessionId = newSessionId();
  const payload: ChatSessionPayload = {
    studentId: input.studentId,
    phone,
    expiresAt: expiresAtIso(CHAT_SESSION_TTL_SECONDS),
  };

  await saveChatSession(sessionId, payload, CHAT_SESSION_TTL_SECONDS);
  await setSignedChatCookie(
    CHAT_SESSION_COOKIE,
    sessionId,
    CHAT_SESSION_TTL_SECONDS,
  );
  await clearPendingChatSelection();

  return payload;
}

export async function readChatSession(): Promise<ChatSessionPayload | null> {
  const sessionId = await readSignedChatCookie(CHAT_SESSION_COOKIE);
  if (!sessionId) return null;
  return loadChatSession(sessionId);
}

export async function clearChatSession(): Promise<void> {
  const sessionId = await readSignedChatCookie(CHAT_SESSION_COOKIE);
  if (sessionId) await deleteChatSession(sessionId);
  await clearChatCookie(CHAT_SESSION_COOKIE);
}

export async function createPendingChatSelection(input: {
  phone: string;
  candidateIds: string[];
}): Promise<ChatPendingPayload> {
  const phone = normalizeKenyaPhone(input.phone);
  if (!phone) {
    throw new Error("[kusoma] Pending chat phone is not a valid Kenyan number.");
  }
  if (
    input.candidateIds.length < 2 ||
    input.candidateIds.some((id) => !UUID.test(id))
  ) {
    throw new Error("[kusoma] Pending chat needs at least two student UUIDs.");
  }

  const sessionId = newSessionId();
  const payload: ChatPendingPayload = {
    phone,
    candidateIds: [...new Set(input.candidateIds)],
    expiresAt: expiresAtIso(CHAT_PENDING_TTL_SECONDS),
  };

  await savePendingSelection(sessionId, payload, CHAT_PENDING_TTL_SECONDS);
  await setSignedChatCookie(
    CHAT_PENDING_COOKIE,
    sessionId,
    CHAT_PENDING_TTL_SECONDS,
  );
  await clearChatSession();

  return payload;
}

export async function readPendingChatSelection(): Promise<ChatPendingPayload | null> {
  const sessionId = await readSignedChatCookie(CHAT_PENDING_COOKIE);
  if (!sessionId) return null;
  return loadPendingSelection(sessionId);
}

export async function clearPendingChatSelection(): Promise<void> {
  const sessionId = await readSignedChatCookie(CHAT_PENDING_COOKIE);
  if (sessionId) await deletePendingSelection(sessionId);
  await clearChatCookie(CHAT_PENDING_COOKIE);
}
