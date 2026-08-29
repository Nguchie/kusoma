import "server-only";

/**
 * Current implementation phase (Implementation Guide).
 * Phase 1: tutor auth + roster. Bump to 2 when starting CBC / chat / AI work.
 */
export const KUSOMA_PHASE = 1 as const;

type Phase = 1 | 2;

type MissingVar = {
  name: string;
  phase: Phase;
};

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `[kusoma] ${name} must be a non-negative integer, got "${raw}".`,
    );
  }
  return parsed;
}

function parseUrl(name: string, value: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`[kusoma] ${name} must be a valid URL, got "${value}".`);
  }
}

function collectMissing(
  names: readonly string[],
  phase: Phase,
  missing: MissingVar[],
): void {
  for (const name of names) {
    if (!read(name)) {
      missing.push({ name, phase });
    }
  }
}

function throwIfMissing(missing: MissingVar[]): void {
  if (missing.length === 0) return;

  const lines = missing
    .map((item) => `  - ${item.name} (required from Phase ${item.phase})`)
    .join("\n");

  throw new Error(
    `[kusoma] Missing environment variables:\n${lines}\n` +
      `Copy .env.example to .env.local and fill values (Guide Step 1.3 / 1.4).`,
  );
}

const PHASE_1_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

const PHASE_2_REQUIRED = [
  "ANTHROPIC_API_KEY",
  "CBC_API_URL",
  "CBC_API_KEY",
  "CHAT_SESSION_SECRET",
  "REDIS_URL",
] as const;

function assertPhase(phase: Phase): void {
  const missing: MissingVar[] = [];
  collectMissing(PHASE_1_REQUIRED, 1, missing);
  if (phase >= 2) {
    collectMissing(PHASE_2_REQUIRED, 2, missing);
  }
  throwIfMissing(missing);
}

function loadEnv() {
  assertPhase(KUSOMA_PHASE);

  const supabaseUrl = parseUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    read("NEXT_PUBLIC_SUPABASE_URL")!,
  );
  const appUrl = parseUrl("APP_URL", read("APP_URL") ?? "http://localhost:3000");

  const cbcUrl = read("CBC_API_URL");
  const redisUrl = read("REDIS_URL");
  const mpesaCallbackUrl = read("MPESA_CALLBACK_URL");
  const chatSessionSecret = read("CHAT_SESSION_SECRET");

  if (chatSessionSecret && chatSessionSecret.length < 32) {
    throw new Error(
      "[kusoma] CHAT_SESSION_SECRET must be at least 32 characters (32+ random bytes, hex or base64).",
    );
  }

  return Object.freeze({
    NODE_ENV: read("NODE_ENV") ?? process.env.NODE_ENV ?? "development",
    APP_URL: appUrl,

    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: read("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
    SUPABASE_SERVICE_ROLE_KEY: read("SUPABASE_SERVICE_ROLE_KEY")!,
    DATABASE_URL: parseUrl("DATABASE_URL", read("DATABASE_URL")!),
    DATABASE_DIRECT_URL: read("DATABASE_DIRECT_URL")
      ? parseUrl("DATABASE_DIRECT_URL", read("DATABASE_DIRECT_URL")!)
      : undefined,

    ANTHROPIC_API_KEY: read("ANTHROPIC_API_KEY"),
    CBC_API_URL: cbcUrl ? parseUrl("CBC_API_URL", cbcUrl) : undefined,
    CBC_API_KEY: read("CBC_API_KEY"),
    REDIS_URL: redisUrl ? parseUrl("REDIS_URL", redisUrl) : undefined,

    MPESA_CONSUMER_KEY: read("MPESA_CONSUMER_KEY"),
    MPESA_CONSUMER_SECRET: read("MPESA_CONSUMER_SECRET"),
    MPESA_SHORTCODE: read("MPESA_SHORTCODE"),
    MPESA_PASSKEY: read("MPESA_PASSKEY"),
    MPESA_CALLBACK_URL: mpesaCallbackUrl
      ? parseUrl("MPESA_CALLBACK_URL", mpesaCallbackUrl)
      : undefined,

    CHAT_MIN_SECONDS_BETWEEN_MESSAGES: parsePositiveInt(
      "CHAT_MIN_SECONDS_BETWEEN_MESSAGES",
      3,
    ),
    CHAT_DAILY_MESSAGE_CAP: parsePositiveInt("CHAT_DAILY_MESSAGE_CAP", 80),
    CHAT_SESSION_SECRET: chatSessionSecret,
  });
}

export type Env = ReturnType<typeof loadEnv>;

export const env: Env = loadEnv();

/** Call from Phase 2 entry points if KUSOMA_PHASE is still 1 during a transition. */
export function assertPhase2Env(): void {
  assertPhase(2);
}
