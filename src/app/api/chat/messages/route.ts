import { jsonError } from "@/server/http";
import { requireChatSession } from "@/server/require-chat-session";
import {
  listChatMessagesSince,
  parseMessagesSince,
} from "@/server/services/chat-messages";

export async function GET(request: Request) {
  const auth = await requireChatSession();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const since = parseMessagesSince(url.searchParams.get("since"));
  if (!since) {
    return jsonError("since must be an ISO timestamp.", 400);
  }

  const items = await listChatMessagesSince(auth.session.studentId, since);
  return Response.json({ messages: items });
}
