import "server-only";

import { desc, eq } from "drizzle-orm";

import type { MessageDirection, StudentContext } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { messages, studentPerformance, students, tutors } from "@/lib/db/schema";

export const STUDENT_CONTEXT_RECENT_TOPICS = 5;
export const STUDENT_CONTEXT_RECENT_MESSAGES = 12;

export type CommonError = {
  type: string;
  detail: string;
  count: number;
};

export function parseCommonErrors(raw: unknown): CommonError[] {
  if (!Array.isArray(raw)) return [];

  const errors: CommonError[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.type !== "string" || typeof record.detail !== "string") {
      continue;
    }
    const count =
      typeof record.count === "number"
        ? record.count
        : Number.parseInt(String(record.count), 10);
    errors.push({
      type: record.type,
      detail: record.detail,
      count: Number.isFinite(count) ? count : 0,
    });
  }
  return errors;
}

function asDirection(value: string): MessageDirection | null {
  if (value === "inbound" || value === "outbound") return value;
  return null;
}

function asDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export async function loadStudentContext(
  studentId: string,
): Promise<StudentContext | null> {
  const [row] = await db
    .select({
      firstName: students.firstName,
      grade: students.grade,
      tutorDisplayName: tutors.displayName,
    })
    .from(students)
    .innerJoin(tutors, eq(tutors.id, students.tutorId))
    .where(eq(students.id, studentId))
    .limit(1);

  if (!row) return null;

  const performanceRows = await db
    .select()
    .from(studentPerformance)
    .where(eq(studentPerformance.studentId, studentId))
    .orderBy(
      desc(studentPerformance.lastActiveAt),
      desc(studentPerformance.updatedAt),
    )
    .limit(STUDENT_CONTEXT_RECENT_TOPICS);

  const streakDays = performanceRows.reduce(
    (max, item) => Math.max(max, item.streakDays),
    0,
  );

  const messageRows = await db
    .select({
      direction: messages.direction,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.studentId, studentId))
    .orderBy(desc(messages.createdAt))
    .limit(STUDENT_CONTEXT_RECENT_MESSAGES);

  const recentMessages: StudentContext["recentMessages"] = [];
  for (const item of messageRows.reverse()) {
    const direction = asDirection(item.direction);
    if (!direction) continue;
    recentMessages.push({
      direction,
      body: item.body,
      createdAt: asDate(item.createdAt),
    });
  }

  return {
    student: {
      firstName: row.firstName,
      grade: row.grade,
    },
    tutor: {
      displayName: row.tutorDisplayName,
    },
    performance: {
      recentTopics: performanceRows.map((topic) => ({
        strand: topic.strand,
        subStrand: topic.subStrand,
        totalProblems: topic.totalProblems,
        correctCount: topic.correctCount,
        commonErrors: parseCommonErrors(topic.commonErrors),
      })),
      streakDays,
    },
    recentMessages,
  };
}
