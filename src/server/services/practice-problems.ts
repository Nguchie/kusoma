import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { generatePracticeProblem } from "@/lib/ai/generate-problem";
import type { ContentSource } from "@/lib/ai/types";
import { parseContentSearchHits, searchContent } from "@/lib/cbc";
import { cognitiveLevelsForDifficulty } from "@/lib/cbc/difficulty";
import type { AssignmentDifficulty } from "@/lib/cbc/types";
import { db } from "@/lib/db";
import { practiceProblems } from "@/lib/db/schema";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NextPracticeProblem = {
  problemText: string;
  expectedAnswer: string;
  contentSource: ContentSource;
  cbcContentChunkId: string | null;
};

export type PracticeStudent = {
  id: string;
  grade: number;
};

export type PracticeAssignment = {
  learningOutcome: string;
  difficulty: AssignmentDifficulty;
  strand: string;
  subStrand: string;
};

async function usedCbcChunkIds(studentId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: practiceProblems.cbcContentChunkId })
    .from(practiceProblems)
    .where(
      and(
        eq(practiceProblems.studentId, studentId),
        isNotNull(practiceProblems.cbcContentChunkId),
      ),
    );

  const ids = new Set<string>();
  for (const row of rows) {
    if (row.id) ids.add(row.id);
  }
  return ids;
}

export async function getNextPracticeProblem(
  student: PracticeStudent,
  assignment: PracticeAssignment,
): Promise<
  { ok: true; problem: NextPracticeProblem } | { ok: false; error: string }
> {
  const used = await usedCbcChunkIds(student.id);
  const search = await searchContent({
    query: assignment.learningOutcome,
    grade: student.grade,
    subject: "mathematics",
    content_type: "exam_question",
    cognitive_level: cognitiveLevelsForDifficulty(assignment.difficulty),
    limit: 5,
  });

  if (search.ok) {
    const unused = parseContentSearchHits(search.data).find(
      (hit) =>
        UUID.test(hit.id) &&
        !used.has(hit.id) &&
        hit.answer &&
        hit.body,
    );
    if (unused?.answer) {
      return {
        ok: true,
        problem: {
          problemText: unused.body,
          expectedAnswer: unused.answer,
          contentSource: "cbc_content",
          cbcContentChunkId: unused.id,
        },
      };
    }
  }

  const generated = await generatePracticeProblem({
    grade: student.grade,
    strand: assignment.strand,
    subStrand: assignment.subStrand,
    learningOutcome: assignment.learningOutcome,
    difficulty: assignment.difficulty,
  });

  if (!generated.ok) return generated;

  return {
    ok: true,
    problem: {
      problemText: generated.problem.problemText,
      expectedAnswer: generated.problem.expectedAnswer,
      contentSource: "ai_generated",
      cbcContentChunkId: null,
    },
  };
}
