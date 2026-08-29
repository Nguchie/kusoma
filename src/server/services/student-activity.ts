import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { practiceProblems, studentPerformance } from "@/lib/db/schema";
import { parseCommonErrors } from "@/server/services/student-context";
import { studentBelongsToTutor } from "@/server/services/students";

export type TopicSource = "homework" | "practice" | "both";

export type CommonErrorJson = {
  type: string;
  detail: string;
  count: number;
};

export type TopicPerformanceJson = {
  cbc_node_id: string;
  strand: string;
  sub_strand: string;
  learning_outcome: string;
  source: TopicSource;
  total_problems: number;
  correct_count: number;
  accuracy: number | null;
  common_errors: CommonErrorJson[];
  last_engaged_at: string | null;
  streak_days: number;
};

export type StudentProblemJson = {
  id: string;
  mode: string;
  problem_text: string;
  student_answer: string | null;
  is_correct: boolean | null;
  error_type: string | null;
  error_detail: string | null;
  ai_explanation: string | null;
  content_source: string;
  created_at: string;
  attempted_at: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function nairobiDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysSinceNairobi(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const todayMs = Date.parse(`${nairobiDateKey(now)}T00:00:00+03:00`);
  const thenMs = Date.parse(`${nairobiDateKey(then)}T00:00:00+03:00`);
  return Math.max(0, Math.round((todayMs - thenMs) / 86_400_000));
}

export function formatLastActivity(iso: string | null): string {
  const days = daysSinceNairobi(iso);
  if (days === null) return "No activity yet";
  if (days === 0) return "Active today";
  if (days === 1) return "Last active yesterday";
  return `Last active ${days} days ago`;
}

function sourceFromModes(
  modes: Set<string>,
  assignmentId: string | null,
): TopicSource {
  const homework = modes.has("homework_help");
  const practice = modes.has("topic_practice");
  if (homework && practice) return "both";
  if (homework) return "homework";
  if (practice) return "practice";
  return assignmentId ? "practice" : "homework";
}

export async function listTopicPerformance(
  tutorId: string,
  studentId: string,
): Promise<TopicPerformanceJson[] | null> {
  if (!(await studentBelongsToTutor(tutorId, studentId))) return null;

  const [rows, modeRows] = await Promise.all([
    db
      .select()
      .from(studentPerformance)
      .where(eq(studentPerformance.studentId, studentId))
      .orderBy(
        desc(studentPerformance.lastActiveAt),
        desc(studentPerformance.updatedAt),
      ),
    db
      .select({
        cbcNodeId: practiceProblems.detectedCbcNodeId,
        mode: practiceProblems.mode,
      })
      .from(practiceProblems)
      .where(
        and(
          eq(practiceProblems.studentId, studentId),
          isNotNull(practiceProblems.detectedCbcNodeId),
        ),
      ),
  ]);

  const modesByNode = new Map<string, Set<string>>();
  for (const row of modeRows) {
    if (!row.cbcNodeId) continue;
    const set = modesByNode.get(row.cbcNodeId) ?? new Set<string>();
    set.add(row.mode);
    modesByNode.set(row.cbcNodeId, set);
  }

  return rows.map((row) => {
    const total = row.totalProblems;
    const correct = row.correctCount;
    return {
      cbc_node_id: row.cbcNodeId,
      strand: row.strand,
      sub_strand: row.subStrand,
      learning_outcome: row.learningOutcome,
      source: sourceFromModes(
        modesByNode.get(row.cbcNodeId) ?? new Set(),
        row.assignmentId,
      ),
      total_problems: total,
      correct_count: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
      common_errors: parseCommonErrors(row.commonErrors),
      last_engaged_at: toIso(row.lastActiveAt),
      streak_days: row.streakDays,
    };
  });
}

export function parseProblemMode(
  value: string | null,
): "homework_help" | "topic_practice" | null {
  if (value === "homework_help" || value === "topic_practice") return value;
  return null;
}

export async function listStudentProblems(
  tutorId: string,
  studentId: string,
  mode?: "homework_help" | "topic_practice",
): Promise<StudentProblemJson[] | null> {
  if (!(await studentBelongsToTutor(tutorId, studentId))) return null;

  const rows = await db
    .select()
    .from(practiceProblems)
    .where(
      mode
        ? and(
            eq(practiceProblems.studentId, studentId),
            eq(practiceProblems.mode, mode),
          )
        : eq(practiceProblems.studentId, studentId),
    )
    .orderBy(desc(practiceProblems.createdAt));

  return rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    problem_text: row.problemText,
    student_answer: row.studentAnswer,
    is_correct: row.isCorrect,
    error_type: row.errorType,
    error_detail: row.errorDetail,
    ai_explanation: row.aiExplanation,
    content_source: row.contentSource,
    created_at: toIso(row.createdAt) ?? new Date(0).toISOString(),
    attempted_at: toIso(row.attemptedAt),
  }));
}
