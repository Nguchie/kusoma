import "server-only";

import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Atomic interval + daily cap.
 * 0 = allowed; 1 = too soon; 2 = daily cap.
 */
const RATE_LIMIT_LUA = `
local lastKey = KEYS[1]
local dayKey = KEYS[2]
local nowMs = tonumber(ARGV[1])
local minMs = tonumber(ARGV[2])
local cap = tonumber(ARGV[3])
local lastTtl = tonumber(ARGV[4])
local dayTtl = tonumber(ARGV[5])
local dayRetry = tonumber(ARGV[6])

local last = redis.call('GET', lastKey)
if last then
  local elapsed = nowMs - tonumber(last)
  if elapsed < minMs then
    local wait = math.ceil((minMs - elapsed) / 1000)
    if wait < 1 then wait = 1 end
    return {0, 1, wait}
  end
end

local count = tonumber(redis.call('GET', dayKey) or '0')
if count >= cap then
  return {0, 2, dayRetry}
end

redis.call('SET', lastKey, nowMs, 'EX', lastTtl)
count = redis.call('INCR', dayKey)
if count == 1 then
  redis.call('EXPIRE', dayKey, dayTtl)
end
if count > cap then
  return {0, 2, dayRetry}
end
return {1, 0, 0}
`;

export function nairobiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function secondsUntilNairobiMidnight(now = new Date()): number {
  const eat = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  const nextEatMidnightAsUtc = Date.UTC(
    eat.getUTCFullYear(),
    eat.getUTCMonth(),
    eat.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const nextMidnightUtc = nextEatMidnightAsUtc - NAIROBI_OFFSET_MS;
  return Math.max(1, Math.ceil((nextMidnightUtc - now.getTime()) / 1000));
}

export function chatRateLimitLastKey(studentId: string): string {
  return `chat:rl:${studentId}:last`;
}

export function chatRateLimitDayKey(studentId: string, now = new Date()): string {
  return `chat:rl:${studentId}:day:${nairobiDateKey(now)}`;
}

export type ChatRateLimitOk = { ok: true };
export type ChatRateLimitBlocked = {
  ok: false;
  message: string;
  retryAfterSeconds: number;
};

export async function enforceChatRateLimit(
  studentId: string,
): Promise<ChatRateLimitOk | ChatRateLimitBlocked> {
  const now = new Date();
  const minSeconds = env.CHAT_MIN_SECONDS_BETWEEN_MESSAGES;
  const cap = env.CHAT_DAILY_MESSAGE_CAP;
  const minMs = minSeconds * 1000;
  const dayRetry = secondsUntilNairobiMidnight(now);
  const lastTtl = Math.max(minSeconds * 2, 10);
  const dayTtl = dayRetry + 24 * 60 * 60;

  const raw = (await getRedis().eval(
    RATE_LIMIT_LUA,
    2,
    chatRateLimitLastKey(studentId),
    chatRateLimitDayKey(studentId, now),
    String(now.getTime()),
    String(minMs),
    String(cap),
    String(lastTtl),
    String(dayTtl),
    String(dayRetry),
  )) as unknown;

  const tuple = Array.isArray(raw) ? raw.map(Number) : [0, 1, minSeconds];
  const allowed = tuple[0] === 1;
  const reason = tuple[1] ?? 0;
  const retryAfterSeconds = Math.max(1, tuple[2] ?? minSeconds);

  if (allowed) return { ok: true };

  if (reason === 2) {
    return {
      ok: false,
      message: "Daily message limit reached. Try again tomorrow.",
      retryAfterSeconds,
    };
  }

  return {
    ok: false,
    message: "Wait a few seconds before sending another message.",
    retryAfterSeconds,
  };
}
