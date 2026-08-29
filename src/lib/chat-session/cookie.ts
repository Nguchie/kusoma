import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { signSessionId, verifySignedSessionId } from "@/lib/chat-session/sign";

export function requireChatSessionSecret(): string {
  if (!env.CHAT_SESSION_SECRET) {
    throw new Error(
      "[kusoma] CHAT_SESSION_SECRET is required (Guide Step 2.3). Generate 32+ random bytes as hex.",
    );
  }
  return env.CHAT_SESSION_SECRET;
}

export function chatCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setSignedChatCookie(
  name: string,
  sessionId: string,
  maxAge: number,
): Promise<void> {
  const jar = await cookies();
  jar.set(
    name,
    signSessionId(sessionId, requireChatSessionSecret()),
    chatCookieOptions(maxAge),
  );
}

export async function readSignedChatCookie(name: string): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(name)?.value;
  if (!raw) return null;
  return verifySignedSessionId(raw, requireChatSessionSecret());
}

export async function clearChatCookie(name: string): Promise<void> {
  const jar = await cookies();
  jar.set(name, "", { ...chatCookieOptions(0), maxAge: 0 });
}
