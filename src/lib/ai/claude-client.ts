/**
 * Bedrock Claude client. No `server-only` — the worker imports this too.
 * Kusoma does not use the Anthropic API; credentials are AWS IAM (or a Bedrock bearer token).
 */
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

export const DEFAULT_BEDROCK_MODEL = "global.anthropic.claude-sonnet-4-6";

export const CLAUDE_NOT_CONFIGURED =
  "Claude is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION (Bedrock).";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function claudeModel(): string {
  return read("CLAUDE_MODEL") ?? DEFAULT_BEDROCK_MODEL;
}

export function createClaudeClient(): AnthropicBedrock | null {
  const awsRegion = read("AWS_REGION");
  if (!awsRegion) return null;

  const bearer = read("AWS_BEARER_TOKEN_BEDROCK");
  if (bearer) {
    return new AnthropicBedrock({ awsRegion, apiKey: bearer });
  }

  const awsAccessKey = read("AWS_ACCESS_KEY_ID");
  const awsSecretKey = read("AWS_SECRET_ACCESS_KEY");
  if (!awsAccessKey || !awsSecretKey) return null;

  return new AnthropicBedrock({
    awsRegion,
    awsAccessKey,
    awsSecretKey,
    awsSessionToken: read("AWS_SESSION_TOKEN"),
  });
}
