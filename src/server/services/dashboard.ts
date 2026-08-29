import "server-only";

import { and, count, countDistinct, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  messages,
  parentReports,
  payments,
  students,
} from "@/lib/db/schema";

export type DashboardSummary = {
  active_students: number;
  engagement_today: number;
  pending_reports: number;
  overdue_payments: number;
};

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const nairobiToday = sql`(timezone('Africa/Nairobi', now()))::date`;
const nairobiMonthStart = sql`(date_trunc('month', timezone('Africa/Nairobi', now())))::date`;
const nairobiNextMonthStart = sql`(date_trunc('month', timezone('Africa/Nairobi', now())) + interval '1 month')::date`;

export async function getDashboardSummary(
  tutorId: string,
): Promise<DashboardSummary> {
  const [activeRow, engagementRow, reportsRow, paymentsRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(students)
      .where(and(eq(students.tutorId, tutorId), eq(students.isActive, true))),
    db
      .select({ n: countDistinct(messages.studentId) })
      .from(messages)
      .innerJoin(students, eq(students.id, messages.studentId))
      .where(
        and(
          eq(students.tutorId, tutorId),
          eq(messages.direction, "inbound"),
          sql`(${messages.createdAt} AT TIME ZONE 'Africa/Nairobi')::date = ${nairobiToday}`,
        ),
      ),
    db
      .select({ n: count() })
      .from(parentReports)
      .innerJoin(students, eq(students.id, parentReports.studentId))
      .where(
        and(eq(students.tutorId, tutorId), eq(parentReports.status, "draft")),
      ),
    db
      .select({ n: count() })
      .from(payments)
      .where(
        and(
          eq(payments.tutorId, tutorId),
          eq(payments.status, "pending"),
          sql`${payments.periodMonth} >= ${nairobiMonthStart}`,
          sql`${payments.periodMonth} < ${nairobiNextMonthStart}`,
        ),
      ),
  ]);

  return {
    active_students: asCount(activeRow[0]?.n),
    engagement_today: asCount(engagementRow[0]?.n),
    pending_reports: asCount(reportsRow[0]?.n),
    overdue_payments: asCount(paymentsRow[0]?.n),
  };
}
