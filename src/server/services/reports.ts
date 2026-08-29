import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { messages, parentReports, students } from "@/lib/db/schema";
import { studentBelongsToTutor } from "@/server/services/students";

export type ParentReportJson = {
  id: string;
  student_id: string;
  student_name: string;
  grade: number;
  period_start: string;
  period_end: string;
  report_body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function periodToString(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function toJson(
  row: typeof parentReports.$inferSelect,
  student: { firstName: string; grade: number },
): ParentReportJson {
  return {
    id: row.id,
    student_id: row.studentId,
    student_name: student.firstName,
    grade: student.grade,
    period_start: periodToString(row.periodStart),
    period_end: periodToString(row.periodEnd),
    report_body: row.reportBody,
    status: row.status,
    sent_at: toIso(row.sentAt),
    created_at: toIso(row.createdAt) ?? "",
  };
}

export async function listReportsForTutor(
  tutorId: string,
  studentId?: string,
) {
  const rows = await db
    .select({
      report: parentReports,
      firstName: students.firstName,
      grade: students.grade,
    })
    .from(parentReports)
    .innerJoin(students, eq(students.id, parentReports.studentId))
    .where(
      studentId
        ? and(eq(students.tutorId, tutorId), eq(students.id, studentId))
        : eq(students.tutorId, tutorId),
    )
    .orderBy(desc(parentReports.createdAt));

  return rows.map((row) => toJson(row.report, row));
}

export async function getReportForTutor(tutorId: string, reportId: string) {
  const [row] = await db
    .select({
      report: parentReports,
      firstName: students.firstName,
      grade: students.grade,
    })
    .from(parentReports)
    .innerJoin(students, eq(students.id, parentReports.studentId))
    .where(and(eq(parentReports.id, reportId), eq(students.tutorId, tutorId)))
    .limit(1);

  return row ? toJson(row.report, row) : null;
}

export async function updateReportForTutor(input: {
  tutorId: string;
  reportId: string;
  reportBody?: string;
  status?: "approved";
}): Promise<
  | { ok: true; report: ParentReportJson }
  | { ok: false; error: string; status: number }
> {
  const existing = await getReportForTutor(input.tutorId, input.reportId);
  if (!existing) return { ok: false, error: "Report not found.", status: 404 };
  if (existing.status === "sent") {
    return { ok: false, error: "Sent reports cannot be edited.", status: 409 };
  }

  const patch: Partial<typeof parentReports.$inferInsert> = {};
  if (input.reportBody !== undefined) patch.reportBody = input.reportBody;
  if (input.status === "approved") {
    if (existing.status !== "draft" && existing.status !== "approved") {
      return { ok: false, error: "Only drafts can be approved.", status: 409 };
    }
    patch.status = "approved";
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, report: existing };
  }

  const [row] = await db
    .update(parentReports)
    .set(patch)
    .where(eq(parentReports.id, input.reportId))
    .returning();

  if (!row) return { ok: false, error: "Could not update report.", status: 500 };
  return {
    ok: true,
    report: {
      ...existing,
      report_body: row.reportBody,
      status: row.status,
    },
  };
}

export async function sendReportForTutor(
  tutorId: string,
  reportId: string,
): Promise<
  | { ok: true; report: ParentReportJson }
  | { ok: false; error: string; status: number }
> {
  const existing = await getReportForTutor(tutorId, reportId);
  if (!existing) return { ok: false, error: "Report not found.", status: 404 };
  if (existing.status !== "approved") {
    return {
      ok: false,
      error: "Approve the report before sending.",
      status: 409,
    };
  }

  const owned = await studentBelongsToTutor(tutorId, existing.student_id);
  if (!owned) return { ok: false, error: "Report not found.", status: 404 };

  const sentAt = new Date();
  const [row] = await db
    .update(parentReports)
    .set({ status: "sent", sentAt })
    .where(eq(parentReports.id, reportId))
    .returning();

  if (!row) return { ok: false, error: "Could not send report.", status: 500 };

  await db.insert(messages).values({
    studentId: existing.student_id,
    mode: "homework_help",
    direction: "outbound",
    contentType: "template",
    channel: "web_chat",
    body: `A weekly progress report was sent to your parent.\n\n${existing.report_body}`,
  });

  return {
    ok: true,
    report: {
      ...existing,
      status: "sent",
      sent_at: sentAt.toISOString(),
      report_body: row.reportBody,
    },
  };
}
