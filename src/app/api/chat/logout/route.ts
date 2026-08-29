import { clearChatSession, clearPendingChatSelection } from "@/lib/chat-session";

export async function POST() {
  await clearChatSession();
  await clearPendingChatSelection();
  return Response.json({ ok: true });
}
