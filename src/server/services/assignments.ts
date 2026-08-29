import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getNode } from "@/lib/cbc";
import { parseCbcNodeDisplay } from "@/lib/cbc/tree";
import type { AssignmentDifficulty } from "@/lib/cbc/types";
import { db } from "@/lib/db";
import { assignments, students } from "@/lib/db/schema";

export type AssignmentJson = {
  id: string;
  student_id: string;
  cbc_node_id: string;
  strand: string;
  sub_strand: string;
  learning_outcome: string;
  difficulty: string;
  status: string;
  tutor_notes: string | null;
  assigned_at: string | null;
  completed_at: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export function toAssignmentJson(
  row: typeof assignments.$inferSelect,
): AssignmentJson {
  return {
    id: row.id,
    student_id: row.studentId,
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

export function parseDifficulty(
  value: string | undefined,
): AssignmentDifficulty | null {
  if (value === undefined || value === "") return "intermediate";
  if (
    value === "foundational" ||
    value === "intermediate" ||
    value === "advanced"
  ) {
    return value;
  }
  return null;
}

export function parseAssignmentStatus(
  value: string | undefined,
): "active" | "completed" | "paused" | null {
  if (value === "active" || value === "completed" || value === "paused") {
    return value;
  }
  return null;
}

async function studentOwnedByTutor(tutorId: string, studentId: string) {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tutorId, tutorId)))
    .limit(1);
  return row ?? null;
}

export async function listAssignmentsForStudent(
  tutorId: string,
  studentId: string,
) {
  const owned = await studentOwnedByTutor(tutorId, studentId);
  if (!owned) return null;

  const rows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.studentId, studentId))
    .orderBy(desc(assignments.assignedAt));

  return rows.map(toAssignmentJson);
}

export async function getActiveAssignmentForStudent(studentId: string) {
  const [row] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.studentId, studentId),
        eq(assignments.status, "active"),
      ),
    )
    .orderBy(desc(assignments.assignedAt))
    .limit(1);
  return row ? toAssignmentJson(row) : null;
}

function clipDisplay(value: string, max = 500): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function displayFromClient(input: {
  strand?: string;
  subStrand?: string;
  learningOutcome?: string;
}): { strand: string; subStrand: string; learningOutcome: string } | null {
  const strand = input.strand ? clipDisplay(input.strand) : "";
  const subStrand = input.subStrand ? clipDisplay(input.subStrand) : "";
  const learningOutcome = input.learningOutcome
    ? clipDisplay(input.learningOutcome)
    : "";
  if (!strand || !subStrand || !learningOutcome) return null;
  return { strand, subStrand, learningOutcome };
}

export async function createAssignment(input: {
  tutorId: string;
  studentId: string;
  cbcNodeId: string;
  difficulty: AssignmentDifficulty;
  strand?: string;
  subStrand?: string;
  learningOutcome?: string;
}): Promise<
  | { ok: true; assignment: AssignmentJson }
  | { ok: false; error: string; status: number }
> {
  const owned = await studentOwnedByTutor(input.tutorId, input.studentId);
  if (!owned) {
    return { ok: false, error: "Student not found.", status: 404 };
  }

  const node = await getNode(input.cbcNodeId);
  if (!node.ok) {
    return {
      ok: false,
      error:
        "Curriculum data is temporarily unavailable — try again in a moment",
      status: node.error.kind === "timeout" ? 504 : 502,
    };
  }

  const fromNode = parseCbcNodeDisplay(node.data);
  const display = fromNode
    ? {
        strand: clipDisplay(fromNode.strand),
        subStrand: clipDisplay(fromNode.subStrand),
        learningOutcome: clipDisplay(fromNode.learningOutcome),
      }
    : displayFromClient(input);
  if (!display) {
    return {
      ok: false,
      error: "Could not read that topic from the curriculum.",
      status: 502,
    };
  }

  const created = await db.transaction(async (tx) => {
    await tx
      .update(assignments)
      .set({ status: "paused" })
      .where(
        and(
          eq(assignments.studentId, input.studentId),
          eq(assignments.status, "active"),
        ),
      );

    const [row] = await tx
      .insert(assignments)
      .values({
        studentId: input.studentId,
        cbcNodeId: input.cbcNodeId,
        strand: display.strand,
        subStrand: display.subStrand,
        learningOutcome: display.learningOutcome,
        difficulty: input.difficulty,
        status: "active",
      })
      .returning();

    return row ?? null;
  });

  if (!created) {
    return { ok: false, error: "Could not create assignment.", status: 500 };
  }
  return { ok: true, assignment: toAssignmentJson(created) };
}

export async function updateAssignment(input: {
  tutorId: string;
  assignmentId: string;
  difficulty?: AssignmentDifficulty;
  status?: "active" | "completed" | "paused";
  tutorNotes?: string | null;
}): Promise<
  | { ok: true; assignment: AssignmentJson }
  | { ok: false; error: string; status: number }
> {
  const [existing] = await db
    .select({
      assignment: assignments,
      tutorId: students.tutorId,
      studentId: students.id,
    })
    .from(assignments)
    .innerJoin(students, eq(students.id, assignments.studentId))
    .where(eq(assignments.id, input.assignmentId))
    .limit(1);

  if (!existing || existing.tutorId !== input.tutorId) {
    return { ok: false, error: "Assignment not found.", status: 404 };
  }

  const patch: Partial<typeof assignments.$inferInsert> = {};
  if (input.difficulty !== undefined) patch.difficulty = input.difficulty;
  if (input.tutorNotes !== undefined) patch.tutorNotes = input.tutorNotes;
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completedAt = input.status === "completed" ? new Date() : null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, assignment: toAssignmentJson(existing.assignment) };
  }

  const updated = await db.transaction(async (tx) => {
    if (input.status === "active") {
      await tx
        .update(assignments)
        .set({ status: "paused" })
        .where(
          and(
            eq(assignments.studentId, existing.studentId),
            eq(assignments.status, "active"),
          ),
        );
    }

    const [row] = await tx
      .update(assignments)
      .set(patch)
      .where(eq(assignments.id, input.assignmentId))
      .returning();
    return row ?? null;
  });

  if (!updated) {
    return { ok: false, error: "Could not update assignment.", status: 500 };
  }
  return { ok: true, assignment: toAssignmentJson(updated) };
}
