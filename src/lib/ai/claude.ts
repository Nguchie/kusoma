import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export function getAnthropicClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export function textFromClaudeMessage(message: Anthropic.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n").trim();
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const data: unknown = JSON.parse(stripped);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return null;
    }
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}
