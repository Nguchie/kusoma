import type { Metadata } from "next";

import { ChatApp } from "@/components/chat/chat-app";
import { readChatSession } from "@/lib/chat-session";
import {
  getActiveStudentById,
  toChatStudentPreview,
} from "@/server/services/chat-identity";

export const metadata: Metadata = {
  title: "Chat · Kusoma",
};

export default async function ChatPage() {
  const session = await readChatSession();
  const row = session ? await getActiveStudentById(session.studentId) : null;
  const student = row ? toChatStudentPreview(row) : null;

  return <ChatApp initialStudent={student} />;
}
