import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  assignments,
  guardians,
  messages,
  studentPerformance,
  students,
} from "@/lib/db/schema";
import { normalizeKenyaPhone } from "@/lib/phone";

export type GuardianInput = {
  displayName: string;
  phone: string;
  receivesReports: boolean;
};

export type CreateStudentInput = {
  firstName: string;
  grade: number;
  phone: string;
  guardian?: GuardianInput;
};

export type UpdateStudentInput = {
  firstName?: string;
  grade?: number;
  phone?: string;
  nudgeTime?: string;
  isActive?: boolean;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function laterIso(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): string | null {
  const first = toIso(a);
  const second = toIso(b);
  if (!first) return second;
  if (!second) return first;
  return Date.parse(first) >= Date.parse(second) ? first : second;
}

export async function studentBelongsToTutor(
  tutorId: string,
  studentId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tutorId, tutorId)))
    .limit(1);
  return Boolean(row);
}

export function toStudentJson(
  row: typeof students.$inferSelect,
  extra?: { latest_activity_at?: string | null },
) {
  return {
    id: row.id,
    first_name: row.firstName,
    grade: row.grade,
    phone: row.phone,
    nudge_time: row.nudgeTime,
    is_active: row.isActive,
    latest_activity_at: extra?.latest_activity_at ?? null,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toGuardianJson(row: typeof guardians.$inferSelect) {
  return {
    id: row.id,
    display_name: row.displayName,
    phone: row.phone,
    receives_reports: row.receivesReports,
    created_at: toIso(row.createdAt),
  };
}

function toAssignmentJson(row: typeof assignments.$inferSelect) {
  return {
    id: row.id,
    cbc_node_id: row.cbcNodeId,
    strand: row.strand,
    sub_strand: row.subStrand,
    learning_outcome: row.learningOutcome,
    difficulty: row.difficulty,
    status: row.status,
    tutor_notes: row.tutorNotes,
    assigned_at: toIso(row.assignedAt),
    completed_at: toIso(row.completedAt),
  };
}

export async function listStudents(tutorId: string) {
  const rows = await db
    .select({
      student: students,
      latestActivityAt: sql<Date | string | null>`(
        select max(${messages.createdAt})
        from ${messages}
        where ${messages.studentId} = ${students.id}
      )`,
    })
    .from(students)
    .where(eq(students.tutorId, tutorId))
    .orderBy(desc(students.createdAt));

  return rows.map((row) =>
    toStudentJson(row.student, {
      latest_activity_at: toIso(row.latestActivityAt),
    }),
  );
}

export async function createStudent(tutorId: string, input: CreateStudentInput) {
  return db.transaction(async (tx) => {
    const [student] = await tx
      .insert(students)
      .values({
        tutorId,
        firstName: input.firstName,
        grade: input.grade,
        phone: input.phone,
      })
      .returning();

    if (!student) throw new Error("Failed to create student.");

    let guardian: typeof guardians.$inferSelect | null = null;
    if (input.guardian) {
      const [created] = await tx
        .insert(guardians)
        .values({
          studentId: student.id,
          displayName: input.guardian.displayName,
          phone: input.guardian.phone,
          receivesReports: input.guardian.receivesReports,
        })
        .returning();
      guardian = created ?? null;
    }

    return {
      ...toStudentJson(student),
      guardian: guardian ? toGuardianJson(guardian) : null,
    };
  });
}

export async function getStudentForTutor(tutorId: string, studentId: string) {
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tutorId, tutorId)))
    .limit(1);

  if (!student) return null;

  const guardianRows = await db
    .select()
    .from(guardians)
    .where(eq(guardians.studentId, student.id));

  const [activeAssignment] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.studentId, student.id),
        eq(assignments.status, "active"),
      ),
    )
    .orderBy(desc(assignments.assignedAt))
    .limit(1);

  const [latest] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.studentId, student.id))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const [latestPerf] = await db
    .select({ lastActiveAt: studentPerformance.lastActiveAt })
    .from(studentPerformance)
    .where(eq(studentPerformance.studentId, student.id))
    .orderBy(desc(studentPerformance.lastActiveAt))
    .limit(1);

  return {
    ...toStudentJson(student, {
      latest_activity_at: laterIso(latest?.createdAt, latestPerf?.lastActiveAt),
    }),
    guardians: guardianRows.map(toGuardianJson),
    active_assignment: activeAssignment
      ? toAssignmentJson(activeAssignment)
      : null,
  };
}

export async function updateStudent(
  tutorId: string,
  studentId: string,
  input: UpdateStudentInput,
) {
  const patch: Partial<typeof students.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.firstName !== undefined) patch.firstName = input.firstName;
  if (input.grade !== undefined) patch.grade = input.grade;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.nudgeTime !== undefined) patch.nudgeTime = input.nudgeTime;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const [updated] = await db
    .update(students)
    .set(patch)
    .where(and(eq(students.id, studentId), eq(students.tutorId, tutorId)))
    .returning();

  return updated ? toStudentJson(updated) : null;
}

export async function deactivateStudent(tutorId: string, studentId: string) {
  return updateStudent(tutorId, studentId, { isActive: false });
}

export function parseGrade(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > 9) return null;
  return value;
}

export function parseNudgeTime(value: string): string | null {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  return value.length === 5 ? `${value}:00` : value;
}

export function parseStudentPhone(raw: string): string | null {
  return normalizeKenyaPhone(raw);
}
