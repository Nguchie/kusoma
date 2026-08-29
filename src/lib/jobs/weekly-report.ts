import { and, eq } from "drizzle-orm";

import { claudeModel, createClaudeClient } from "@/lib/ai/claude-client";

import { weeklyReportPrompt } from "@/lib/ai/prompts";
import type { Db } from "@/lib/db/client";
import {
  parentReports,
  studentPerformance,
  students,
  tutors,
} from "@/lib/db/schema";
import { addNairobiDays, nairobiDateKey } from "@/lib/jobs/eat";

export function reportPeriodFor(now = new Date()): {
  start: string;
  end: string;
} {
  const end = nairobiDateKey(now);
  return { start: addNairobiDays(end, -6), end };
}

function fallbackBody(input: {
  firstName: string;
  topics: Array<{
    learningOutcome: string;
    correctCount: number;
    totalProblems: number;
  }>;
}): string {
  if (input.topics.length === 0) {
    return `${input.firstName} was enrolled this week but has not completed scored practice or homework yet.`;
  }
  const bits = input.topics.map((topic) => {
    const pct =
      topic.totalProblems > 0
        ? Math.round((topic.correctCount / topic.totalProblems) * 100)
        : 0;
    return `${topic.learningOutcome} (${pct}%)`;
  });
  return `${input.firstName} worked on ${bits.join("; ")} this week. Please review the full notes with their tutor.`;
}

async function draftWithClaude(prompt: string): Promise<string | null> {
  const client = createClaudeClient();
  if (!client) return null;
  try {
    const message = await client.messages.create({
      model: claudeModel(),
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function runWeeklyReport(
  db: Db,
  options?: { now?: Date },
): Promise<{ created: number; skipped: number }> {
  const now = options?.now ?? new Date();
  const period = reportPeriodFor(now);

  const active = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      grade: students.grade,
      tutorName: tutors.displayName,
    })
    .from(students)
    .innerJoin(tutors, eq(tutors.id, students.tutorId))
    .where(eq(students.isActive, true));

  let created = 0;
  let skipped = 0;

  for (const student of active) {
    const topics = await db
      .select({
        strand: studentPerformance.strand,
        subStrand: studentPerformance.subStrand,
        learningOutcome: studentPerformance.learningOutcome,
        correctCount: studentPerformance.correctCount,
        totalProblems: studentPerformance.totalProblems,
      })
      .from(studentPerformance)
      .where(eq(studentPerformance.studentId, student.id));

    const [existing] = await db
      .select({ id: parentReports.id })
      .from(parentReports)
      .where(
        and(
          eq(parentReports.studentId, student.id),
          eq(parentReports.periodStart, period.start),
          eq(parentReports.periodEnd, period.end),
        ),
      )
      .limit(1);

    if (existing) {
      skipped += 1;
      continue;
    }

    if (topics.length === 0) {
      skipped += 1;
      continue;
    }

    const prompt = weeklyReportPrompt({
      firstName: student.firstName,
      grade: student.grade,
      tutorName: student.tutorName,
      periodStart: period.start,
      periodEnd: period.end,
      topics,
    });
    const drafted = await draftWithClaude(prompt);
    const reportBody =
      drafted ?? fallbackBody({ firstName: student.firstName, topics });

    await db.insert(parentReports).values({
      studentId: student.id,
      periodStart: period.start,
      periodEnd: period.end,
      reportBody,
      status: "draft",
    });
    created += 1;
  }

  return { created, skipped };
}
