import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { payments, students } from "@/lib/db/schema";
import { nairobiMonthStart } from "@/lib/jobs/eat";
import { studentBelongsToTutor } from "@/server/services/students";

export type PaymentJson = {
  id: string;
  student_id: string | null;
  student_name: string | null;
  amount: number;
  period_month: string;
  status: string;
  mpesa_receipt: string | null;
  paid_at: string | null;
  created_at: string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function monthToString(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function toJson(
  row: typeof payments.$inferSelect,
  studentName: string | null,
): PaymentJson {
  return {
    id: row.id,
    student_id: row.studentId,
    student_name: studentName,
    amount: row.amount,
    period_month: monthToString(row.periodMonth),
    status: row.status,
    mpesa_receipt: row.mpesaReceipt,
    paid_at: toIso(row.paidAt),
    created_at: toIso(row.createdAt) ?? "",
  };
}

export function parsePeriodMonth(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed.slice(0, 7)}-01`;
  return null;
}

export function parsePaymentStatus(
  value: string | undefined,
): "pending" | "completed" | "failed" | null {
  if (value === "pending" || value === "completed" || value === "failed") {
    return value;
  }
  return null;
}

export async function getPaymentsOverview(tutorId: string, now = new Date()) {
  const monthStart = nairobiMonthStart(now);
  const rows = await db
    .select({
      payment: payments,
      firstName: students.firstName,
    })
    .from(payments)
    .leftJoin(students, eq(students.id, payments.studentId))
    .where(
      and(
        eq(payments.tutorId, tutorId),
        sql`${payments.periodMonth} >= ${monthStart}::date`,
        sql`${payments.periodMonth} < (${monthStart}::date + interval '1 month')`,
      ),
    )
    .orderBy(desc(payments.createdAt));

  const items = rows.map((row) => toJson(row.payment, row.firstName ?? null));
  const pending = items.filter((item) => item.status === "pending");
  const completed = items.filter((item) => item.status === "completed");

  return {
    period_month: monthStart,
    pending_count: pending.length,
    pending_amount: pending.reduce((sum, item) => sum + item.amount, 0),
    completed_count: completed.length,
    completed_amount: completed.reduce((sum, item) => sum + item.amount, 0),
    payments: items,
  };
}

export async function listPaymentHistory(
  tutorId: string,
  input: { limit: number; offset: number },
) {
  const rows = await db
    .select({
      payment: payments,
      firstName: students.firstName,
    })
    .from(payments)
    .leftJoin(students, eq(students.id, payments.studentId))
    .where(eq(payments.tutorId, tutorId))
    .orderBy(desc(payments.createdAt))
    .limit(input.limit + 1)
    .offset(input.offset);

  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  return {
    payments: page.map((row) => toJson(row.payment, row.firstName ?? null)),
    next_offset: hasMore ? input.offset + input.limit : null,
  };
}

export async function createPayment(input: {
  tutorId: string;
  studentId: string;
  amount: number;
  periodMonth: string;
  status: "pending" | "completed" | "failed";
  mpesaReceipt?: string | null;
}): Promise<
  | { ok: true; payment: PaymentJson }
  | { ok: false; error: string; status: number }
> {
  if (!(await studentBelongsToTutor(input.tutorId, input.studentId))) {
    return { ok: false, error: "Student not found.", status: 404 };
  }
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    return { ok: false, error: "amount must be a positive integer (KES).", status: 400 };
  }

  const paidAt = input.status === "completed" ? new Date() : null;
  const [row] = await db
    .insert(payments)
    .values({
      tutorId: input.tutorId,
      studentId: input.studentId,
      amount: input.amount,
      periodMonth: input.periodMonth,
      status: input.status,
      mpesaReceipt: input.mpesaReceipt ?? null,
      paidAt,
    })
    .returning();

  if (!row) return { ok: false, error: "Could not save payment.", status: 500 };

  const [student] = await db
    .select({ firstName: students.firstName })
    .from(students)
    .where(eq(students.id, input.studentId))
    .limit(1);

  return { ok: true, payment: toJson(row, student?.firstName ?? null) };
}

export async function updatePaymentStatus(input: {
  tutorId: string;
  paymentId: string;
  status: "pending" | "completed" | "failed";
  mpesaReceipt?: string | null;
}): Promise<
  | { ok: true; payment: PaymentJson }
  | { ok: false; error: string; status: number }
> {
  const [existing] = await db
    .select({ payment: payments, firstName: students.firstName })
    .from(payments)
    .leftJoin(students, eq(students.id, payments.studentId))
    .where(and(eq(payments.id, input.paymentId), eq(payments.tutorId, input.tutorId)))
    .limit(1);

  if (!existing) return { ok: false, error: "Payment not found.", status: 404 };

  const [row] = await db
    .update(payments)
    .set({
      status: input.status,
      mpesaReceipt:
        input.mpesaReceipt !== undefined
          ? input.mpesaReceipt
          : existing.payment.mpesaReceipt,
      paidAt: input.status === "completed" ? new Date() : null,
    })
    .where(eq(payments.id, input.paymentId))
    .returning();

  if (!row) return { ok: false, error: "Could not update payment.", status: 500 };
  return { ok: true, payment: toJson(row, existing.firstName ?? null) };
}
