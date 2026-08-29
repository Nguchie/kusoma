import "server-only";

import { readChatSession } from "@/lib/chat-session";
import type { ChatSessionPayload } from "@/lib/chat-session";
import { jsonError } from "@/server/http";

export async function requireChatSession(): Promise<
  | { session: ChatSessionPayload; response?: never }
  | { session?: never; response: Response }
> {
  const session = await readChatSession();
  if (!session) {
    return { response: jsonError("unauthorized", 401) };
  }
  return { session };
}
