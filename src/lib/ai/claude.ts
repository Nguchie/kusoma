import "server-only";

import { createClaudeClient } from "@/lib/ai/claude-client";

export {
  CLAUDE_NOT_CONFIGURED,
  claudeModel,
  createClaudeClient,
  DEFAULT_BEDROCK_MODEL,
} from "@/lib/ai/claude-client";

/** Bedrock inference profile; override with CLAUDE_MODEL. */
export const CLAUDE_MODEL = "global.anthropic.claude-sonnet-4-6";

export function getAnthropicClient() {
  return createClaudeClient();
}

export function textFromClaudeMessage(message: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text" && block.text) parts.push(block.text);
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
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
