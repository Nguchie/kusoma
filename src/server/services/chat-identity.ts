import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { normalizeKenyaPhone } from "@/lib/phone";

export type ChatStudentPreview = {
  id: string;
  first_name: string;
  grade: number;
};

export function toChatStudentPreview(row: {
  id: string;
  firstName: string;
  grade: number;
}): ChatStudentPreview {
  return {
    id: row.id,
    first_name: row.firstName,
    grade: row.grade,
  };
}

export async function findActiveStudentsByPhone(rawPhone: string) {
  const phone = normalizeKenyaPhone(rawPhone);
  if (!phone) return { phone: null, rows: [] as typeof students.$inferSelect[] };

  const rows = await db
    .select()
    .from(students)
    .where(and(eq(students.phone, phone), eq(students.isActive, true)))
    .orderBy(students.firstName);

  return { phone, rows };
}

export async function getActiveStudentById(studentId: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.isActive, true)))
    .limit(1);

  return row ?? null;
}
