import { and, eq, sql } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import { assignments, messages, students } from "@/lib/db/schema";
import { isInNudgeWindow, nairobiDateKey } from "@/lib/jobs/eat";

export const PRACTICE_NUDGE_BODY = (firstName: string) =>
  `Hi ${firstName}, you have practice questions today. Open the chat to begin.`;

export async function runPracticeNudge(
  db: Db,
  now = new Date(),
): Promise<{ sent: number; skipped: number }> {
  const today = nairobiDateKey(now);

  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      nudgeTime: students.nudgeTime,
    })
    .from(students)
    .innerJoin(assignments, eq(assignments.studentId, students.id))
    .where(
      and(eq(students.isActive, true), eq(assignments.status, "active")),
    );

  const seen = new Set<string>();
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);

    if (!isInNudgeWindow(row.nudgeTime, now)) {
      skipped += 1;
      continue;
    }

    const [already] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.studentId, row.id),
          eq(messages.direction, "outbound"),
          eq(messages.contentType, "template"),
          eq(messages.mode, "topic_practice"),
          sql`(${messages.createdAt} AT TIME ZONE 'Africa/Nairobi')::date = ${today}::date`,
        ),
      )
      .limit(1);

    if (already) {
      skipped += 1;
      continue;
    }

    await db.insert(messages).values({
      studentId: row.id,
      mode: "topic_practice",
      direction: "outbound",
      contentType: "template",
      channel: "web_chat",
      body: PRACTICE_NUDGE_BODY(row.firstName),
    });
    sent += 1;
  }

  return { sent, skipped };
}
