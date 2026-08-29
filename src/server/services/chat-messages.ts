import "server-only";

import { and, asc, desc, eq, gt, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import {
  isHomeworkImagePath,
  signedHomeworkImageUrl,
} from "@/lib/storage/homework-images";
import { studentBelongsToTutor } from "@/server/services/students";

export type ChatMessageJson = {
  id: string;
  assignment_id: string | null;
  mode: string;
  direction: string;
  content_type: string;
  body: string;
  image_url: string | null;
  channel: string;
  created_at: string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export function toChatMessageJson(
  row: typeof messages.$inferSelect,
): ChatMessageJson {
  return {
    id: row.id,
    assignment_id: row.assignmentId,
    mode: row.mode,
    direction: row.direction,
    content_type: row.contentType,
    body: row.body,
    image_url: row.imageUrl,
    channel: row.channel,
    created_at: toIso(row.createdAt),
  };
}

async function withSignedImageUrl(
  item: ChatMessageJson,
): Promise<ChatMessageJson> {
  if (!item.image_url || !isHomeworkImagePath(item.image_url)) return item;
  const signed = await signedHomeworkImageUrl(item.image_url);
  return { ...item, image_url: signed };
}

export async function signChatMessageImages(
  items: ChatMessageJson[],
): Promise<ChatMessageJson[]> {
  return Promise.all(items.map(withSignedImageUrl));
}

/** `since` omitted or empty → all messages for the student, oldest first. */
export function parseMessagesSince(raw: string | null): Date | null {
  if (raw === null || raw.trim() === "") return new Date(0);
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function listChatMessagesSince(studentId: string, since: Date) {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.studentId, studentId), gt(messages.createdAt, since)),
    )
    .orderBy(asc(messages.createdAt));

  return signChatMessageImages(rows.map(toChatMessageJson));
}

const TUTOR_MESSAGE_LIMIT_MAX = 100;

export function parseTutorMessageLimit(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 50;
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, TUTOR_MESSAGE_LIMIT_MAX);
}

export function parseMessagesBefore(raw: string | null): Date | null {
  if (raw === null || raw.trim() === "") return null;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function listTutorStudentMessages(
  tutorId: string,
  studentId: string,
  input: { limit: number; before: Date | null },
): Promise<{ messages: ChatMessageJson[]; next_before: string | null } | null> {
  if (!(await studentBelongsToTutor(tutorId, studentId))) return null;

  const rows = await db
    .select()
    .from(messages)
    .where(
      input.before
        ? and(
            eq(messages.studentId, studentId),
            lt(messages.createdAt, input.before),
          )
        : eq(messages.studentId, studentId),
    )
    .orderBy(desc(messages.createdAt))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const signed = await signChatMessageImages(page.map(toChatMessageJson));
  const last = signed[signed.length - 1];

  return {
    messages: signed,
    next_before: hasMore && last ? last.created_at : null,
  };
}

export async function insertInboundMessage(input: {
  studentId: string;
  body: string;
  mode: "homework_help" | "topic_practice";
  assignmentId?: string | null;
  imagePath?: string | null;
}) {
  const hasImage = Boolean(input.imagePath);
  const [row] = await db
    .insert(messages)
    .values({
      studentId: input.studentId,
      assignmentId: input.assignmentId ?? null,
      mode: input.mode,
      direction: "inbound",
      contentType: hasImage ? "image" : "text",
      body: input.body,
      imageUrl: input.imagePath ?? null,
      channel: "web_chat",
    })
    .returning();

  if (!row) throw new Error("[kusoma] Failed to insert inbound message.");
  const [signed] = await signChatMessageImages([toChatMessageJson(row)]);
  return signed!;
}

export async function insertInboundImageMessage(input: {
  studentId: string;
  body: string;
  imagePath: string;
}) {
  return insertInboundMessage({
    studentId: input.studentId,
    body: input.body,
    mode: "homework_help",
    imagePath: input.imagePath,
  });
}
