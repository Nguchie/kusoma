import "server-only";

import {
  chatPendingRedisKey,
  chatSessionRedisKey,
} from "@/lib/chat-session/constants";
import type {
  ChatPendingPayload,
  ChatSessionPayload,
} from "@/lib/chat-session/types";
import { getRedis } from "@/lib/redis";

function asRecord(raw: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return null;
    }
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseSessionPayload(raw: string): ChatSessionPayload | null {
  const record = asRecord(raw);
  if (!record) return null;
  if (
    typeof record.studentId !== "string" ||
    typeof record.phone !== "string" ||
    typeof record.expiresAt !== "string"
  ) {
    return null;
  }
  return {
    studentId: record.studentId,
    phone: record.phone,
    expiresAt: record.expiresAt,
  };
}

function parsePendingPayload(raw: string): ChatPendingPayload | null {
  const record = asRecord(raw);
  if (!record) return null;
  if (
    typeof record.phone !== "string" ||
    typeof record.expiresAt !== "string" ||
    !Array.isArray(record.candidateIds) ||
    record.candidateIds.length === 0 ||
    record.candidateIds.some((id) => typeof id !== "string")
  ) {
    return null;
  }
  return {
    phone: record.phone,
    candidateIds: record.candidateIds as string[],
    expiresAt: record.expiresAt,
  };
}

function stillValid(expiresAt: string): boolean {
  const ms = Date.parse(expiresAt);
  return Number.isFinite(ms) && ms > Date.now();
}

export async function saveChatSession(
  sessionId: string,
  payload: ChatSessionPayload,
  ttlSeconds: number,
): Promise<void> {
  await getRedis().set(
    chatSessionRedisKey(sessionId),
    JSON.stringify(payload),
    "EX",
    ttlSeconds,
  );
}

export async function loadChatSession(
  sessionId: string,
): Promise<ChatSessionPayload | null> {
  const raw = await getRedis().get(chatSessionRedisKey(sessionId));
  if (!raw) return null;

  const payload = parseSessionPayload(raw);
  if (!payload || !stillValid(payload.expiresAt)) {
    await deleteChatSession(sessionId);
    return null;
  }

  return payload;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await getRedis().del(chatSessionRedisKey(sessionId));
}

export async function savePendingSelection(
  sessionId: string,
  payload: ChatPendingPayload,
  ttlSeconds: number,
): Promise<void> {
  await getRedis().set(
    chatPendingRedisKey(sessionId),
    JSON.stringify(payload),
    "EX",
    ttlSeconds,
  );
}

export async function loadPendingSelection(
  sessionId: string,
): Promise<ChatPendingPayload | null> {
  const raw = await getRedis().get(chatPendingRedisKey(sessionId));
  if (!raw) return null;

  const payload = parsePendingPayload(raw);
  if (!payload || !stillValid(payload.expiresAt)) {
    await deletePendingSelection(sessionId);
    return null;
  }

  return payload;
}

export async function deletePendingSelection(sessionId: string): Promise<void> {
  await getRedis().del(chatPendingRedisKey(sessionId));
}
