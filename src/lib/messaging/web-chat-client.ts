import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { messages, students } from "@/lib/db/schema";
import type {
  ChatContentType,
  ChatMode,
  MessagingClient,
  SendMessageOptions,
} from "@/lib/messaging/types";
import { normalizeKenyaPhone } from "@/lib/phone";

/**
 * Web chat delivery: persist outbound rows. The live `/api/chat/message`
 * HTTP body is still the student-facing reply; `sendText` / `sendTemplate`
 * are for worker-originated messages that only appear on poll.
 *
 * Live chat should treat this as the persist path (do not insert `messages`
 * and also call `sendText`, or you will double-write).
 */
export class WebChatClient implements MessagingClient {
  readonly channel = "web_chat" as const;

  sendText(
    toPhone: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    return this.persist(toPhone, body, "text", options);
  }

  sendTemplate(
    toPhone: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    return this.persist(toPhone, body, "template", {
      mode: "topic_practice",
      ...options,
    });
  }

  private async persist(
    toPhone: string,
    body: string,
    contentType: ChatContentType,
    options?: SendMessageOptions,
  ): Promise<void> {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new Error("[kusoma] Cannot send an empty message.");
    }

    const studentId = await this.resolveStudentId(toPhone, options?.studentId);
    const mode: ChatMode = options?.mode ?? "homework_help";

    await db.insert(messages).values({
      studentId,
      assignmentId: options?.assignmentId ?? null,
      mode,
      direction: "outbound",
      contentType,
      body: trimmed,
      channel: this.channel,
    });
  }

  private async resolveStudentId(
    toPhone: string,
    studentId?: string,
  ): Promise<string> {
    const phone = normalizeKenyaPhone(toPhone);
    if (!phone) {
      throw new Error("[kusoma] Invalid phone number for outbound message.");
    }

    if (studentId) {
      const [row] = await db
        .select({ id: students.id, phone: students.phone })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.isActive, true)))
        .limit(1);

      if (!row) {
        throw new Error("[kusoma] Active student not found for outbound message.");
      }
      if (row.phone !== phone) {
        throw new Error(
          "[kusoma] Student phone does not match outbound recipient.",
        );
      }
      return row.id;
    }

    const matches = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.phone, phone), eq(students.isActive, true)));

    if (matches.length === 0) {
      throw new Error("[kusoma] No active student for that phone.");
    }
    if (matches.length > 1) {
      throw new Error(
        "[kusoma] Several students share this phone; pass studentId.",
      );
    }

    return matches[0]!.id;
  }
}
