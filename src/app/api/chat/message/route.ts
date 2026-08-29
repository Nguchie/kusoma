import { enforceChatRateLimit } from "@/lib/chat-rate-limit";
import { jsonError, readJson, readString } from "@/server/http";
import { requireChatSession } from "@/server/require-chat-session";
import { handleInboundChat } from "@/server/services/inbound-chat";

export const maxDuration = 60;

function readFormString(form: FormData, key: string): string {
  const value = form.get(key);
  if (typeof value !== "string") return "";
  return value.trim();
}

async function readInbound(
  request: Request,
): Promise<
  | { ok: true; body: string; image: File | null }
  | { ok: false; error: string }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    const imageValue = form.get("image");
    const image =
      imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
    const body =
      readFormString(form, "body") || readFormString(form, "text");
    return { ok: true, body, image };
  }

  const json = await readJson(request);
  if (!json) {
    return {
      ok: false,
      error: "Send JSON { body } or multipart form-data.",
    };
  }
  const body = readString(json, "body") ?? readString(json, "text") ?? "";
  return { ok: true, body, image: null };
}

export async function POST(request: Request) {
  const auth = await requireChatSession();
  if (auth.response) return auth.response;

  const limited = await enforceChatRateLimit(auth.session.studentId);
  if (!limited.ok) {
    return jsonError(limited.message, 429, {
      headers: { "retry-after": String(limited.retryAfterSeconds) },
    });
  }

  const inbound = await readInbound(request);
  if (!inbound.ok) return jsonError(inbound.error, 400);

  try {
    const result = await handleInboundChat({
      studentId: auth.session.studentId,
      body: inbound.body,
      image: inbound.image,
    });
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json({
      message: result.message,
      mode: result.mode,
      type: result.type,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process that message.";
    console.error("[kusoma] inbound chat failed:", message);
    return jsonError("Could not process that message.", 500);
  }
}
