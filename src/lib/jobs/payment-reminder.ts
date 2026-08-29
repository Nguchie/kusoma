import { and, eq, sql } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import { messages, payments, students } from "@/lib/db/schema";
import { nairobiMonthStart } from "@/lib/jobs/eat";

export function paymentReminderBody(firstName: string): string {
  return `Hi ${firstName}, please remind your parent that this month's fee is still pending.`;
}

export async function runPaymentReminder(
  db: Db,
  now = new Date(),
): Promise<{ sent: number; skipped: number }> {
  const monthStart = nairobiMonthStart(now);

  const rows = await db
    .select({
      paymentId: payments.id,
      studentId: payments.studentId,
      firstName: students.firstName,
    })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .where(
      and(
        eq(payments.status, "pending"),
        eq(students.isActive, true),
        sql`${payments.periodMonth} >= ${monthStart}::date`,
        sql`${payments.periodMonth} < (${monthStart}::date + interval '1 month')`,
      ),
    );

  const seen = new Set<string>();
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.studentId || seen.has(row.studentId)) {
      skipped += 1;
      continue;
    }
    seen.add(row.studentId);

    const [already] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.studentId, row.studentId),
          eq(messages.direction, "outbound"),
          eq(messages.contentType, "template"),
          eq(messages.body, paymentReminderBody(row.firstName)),
          sql`(${messages.createdAt} AT TIME ZONE 'Africa/Nairobi')::date >= ${monthStart}::date`,
        ),
      )
      .limit(1);

    if (already) {
      skipped += 1;
      continue;
    }

    await db.insert(messages).values({
      studentId: row.studentId,
      mode: "homework_help",
      direction: "outbound",
      contentType: "template",
      channel: "web_chat",
      body: paymentReminderBody(row.firstName),
    });
    sent += 1;
  }

  return { sent, skipped };
}
