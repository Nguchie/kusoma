import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { students, tutors } from "@/lib/db/schema";
import {
  getActiveAssignmentForStudent,
  type AssignmentJson,
} from "@/server/services/assignments";

export type OnboardingStep = "profile" | "student" | "assignment" | "complete";

export type OnboardingStudent = {
  id: string;
  first_name: string;
  grade: number;
  phone: string;
};

export type OnboardingStatus = {
  status: OnboardingStep;
  student: OnboardingStudent | null;
  assignment: AssignmentJson | null;
};

export async function getOnboardingStatus(
  tutor: typeof tutors.$inferSelect,
): Promise<OnboardingStatus> {
  const [student] = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      grade: students.grade,
      phone: students.phone,
    })
    .from(students)
    .where(eq(students.tutorId, tutor.id))
    .limit(1);

  const studentJson: OnboardingStudent | null = student
    ? {
        id: student.id,
        first_name: student.firstName,
        grade: student.grade,
        phone: student.phone,
      }
    : null;
  const assignment = student
    ? await getActiveAssignmentForStudent(student.id)
    : null;

  if (tutor.onboardingCompletedAt) {
    return { status: "complete", student: studentJson, assignment };
  }

  if (!tutor.displayName.trim() || !tutor.phone.trim()) {
    return { status: "profile", student: studentJson, assignment };
  }

  if (!studentJson) {
    return { status: "student", student: null, assignment: null };
  }

  return { status: "assignment", student: studentJson, assignment };
}

export async function completeOnboarding(tutorId: string) {
  const [tutor] = await db
    .select()
    .from(tutors)
    .where(eq(tutors.id, tutorId))
    .limit(1);
  if (!tutor) return { ok: false as const, error: "Tutor not found." };

  const status = await getOnboardingStatus(tutor);
  if (!status.student) {
    return { ok: false as const, error: "Add a student first." };
  }
  if (!status.assignment) {
    return { ok: false as const, error: "Assign a topic first." };
  }

  const now = new Date();
  const [updated] = await db
    .update(tutors)
    .set({
      onboardingCompletedAt: now,
      updatedAt: now,
    })
    .where(eq(tutors.id, tutorId))
    .returning();

  if (!updated) return { ok: false as const, error: "Could not complete onboarding." };
  return { ok: true as const, tutor: updated };
}
