import "server-only";

import {
  CLAUDE_NOT_CONFIGURED,
  claudeModel,
  getAnthropicClient,
  parseJsonObject,
  textFromClaudeMessage,
} from "@/lib/ai/claude";

const VISION_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type HomeworkImageInput = {
  mimeType: string;
  base64: string;
};

export async function homeworkImageFromFile(
  file: File,
): Promise<HomeworkImageInput> {
  return {
    mimeType: file.type || "image/jpeg",
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
  };
}

export async function extractProblemTextFromImage(
  image: HomeworkImageInput,
): Promise<{ ok: true; problemText: string } | { ok: false; error: string }> {
  const client = getAnthropicClient();
  if (!client) {
    return { ok: false, error: CLAUDE_NOT_CONFIGURED };
  }

  const mime = image.mimeType.toLowerCase();
  if (!VISION_TYPES.has(mime)) {
    return {
      ok: false,
      error: "Use a JPEG, PNG, GIF, or WebP image for homework photos.",
    };
  }

  try {
    const message = await client.messages.create({
      model: claudeModel(),
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mime as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: image.base64,
              },
            },
            {
              type: "text",
              text: `Extract the homework mathematics problem as plain text. Ignore handwriting that is not the problem. Respond with JSON only: {"problemText":"..."}`,
            },
          ],
        },
      ],
    });
    const parsed = parseJsonObject(textFromClaudeMessage(message));
    const problemText =
      typeof parsed?.problemText === "string" ? parsed.problemText.trim() : "";
    if (!problemText) {
      return { ok: false, error: "Could not read a problem from that image." };
    }
    return { ok: true, problemText };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Claude vision request failed.";
    return { ok: false, error: message };
  }
}
