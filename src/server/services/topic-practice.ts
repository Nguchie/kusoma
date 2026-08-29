import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import {
  CLAUDE_NOT_CONFIGURED,
  claudeModel,
  getAnthropicClient,
  parseJsonObject,
  textFromClaudeMessage,
} from "@/lib/ai/claude";
import {
  fallbackAiResponse,
  parseTopicPracticeAiResponse,
} from "@/lib/ai/parse-response";
import { topicPracticeSystemPrompt } from "@/lib/ai/prompts";
import type {
  ContentSource,
  TopicPracticeAiResponse,
  TopicPracticeContext,
} from "@/lib/ai/types";
import type { AssignmentDifficulty } from "@/lib/cbc/types";
import { db } from "@/lib/db";
import { assignments, practiceProblems } from "@/lib/db/schema";
import { getNextPracticeProblem } from "@/server/services/practice-problems";
import { processAIResponse } from "@/server/services/process-ai-response";
import { loadStudentContext } from "@/server/services/student-context";

export type ActiveAssignment = typeof assignments.$inferSelect;

export type PendingPracticeProblem = {
  id: string;
  problemText: string;
  expectedAnswer: string;
  contentSource: ContentSource;
  cbcContentChunkId: string | null;
};

function asDifficulty(value: string): AssignmentDifficulty {
  if (
    value === "foundational" ||
    value === "intermediate" ||
    value === "advanced"
  ) {
    return value;
  }
  return "intermediate";
}

function asContentSource(value: string): ContentSource {
  return value === "cbc_content" ? "cbc_content" : "ai_generated";
}

export async function getActiveAssignment(
  studentId: string,
): Promise<ActiveAssignment | null> {
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
  return row ?? null;
}

export async function getPendingPracticeProblem(
  studentId: string,
  assignmentId: string,
): Promise<PendingPracticeProblem | null> {
  const [row] = await db
    .select()
    .from(practiceProblems)
    .where(
      and(
        eq(practiceProblems.studentId, studentId),
        eq(practiceProblems.assignmentId, assignmentId),
        eq(practiceProblems.mode, "topic_practice"),
        isNull(practiceProblems.studentAnswer),
      ),
    )
    .orderBy(desc(practiceProblems.createdAt))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    problemText: row.problemText,
    expectedAnswer: row.expectedAnswer ?? "",
    contentSource: asContentSource(row.contentSource),
    cbcContentChunkId: row.cbcContentChunkId,
  };
}

async function callPracticeClaude(
  ctx: TopicPracticeContext,
  inboundMessage: string,
): Promise<TopicPracticeAiResponse | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const user = ctx.pendingProblem
    ? `The student's answer:\n${inboundMessage}\n\nRespond with the JSON object from the system prompt. No markdown.`
    : "Generate the next practice problem. Respond with the JSON object from the system prompt. No markdown.";

  try {
    const message = await client.messages.create({
      model: claudeModel(),
      max_tokens: 800,
      system: topicPracticeSystemPrompt(ctx),
      messages: [{ role: "user", content: user }],
    });
    return parseTopicPracticeAiResponse(
      parseJsonObject(textFromClaudeMessage(message)),
    );
  } catch {
    return null;
  }
}

async function topicPracticeContext(
  studentId: string,
  assignment: ActiveAssignment,
  pending: PendingPracticeProblem | null,
): Promise<TopicPracticeContext | null> {
  const base = await loadStudentContext(studentId);
  if (!base) return null;
  return {
    ...base,
    mode: "topic_practice",
    assignment: {
      strand: assignment.strand,
      subStrand: assignment.subStrand,
      learningOutcome: assignment.learningOutcome,
      difficulty: asDifficulty(assignment.difficulty),
    },
    pendingProblem: pending
      ? {
          problemText: pending.problemText,
          expectedAnswer: pending.expectedAnswer,
          source: pending.contentSource,
        }
      : null,
  };
}

function assignmentTopic(assignment: ActiveAssignment) {
  return {
    strand: assignment.strand,
    subStrand: assignment.subStrand,
    learningOutcome: assignment.learningOutcome,
    detected: {
      strand: assignment.strand,
      sub_strand: assignment.subStrand,
    },
  };
}

export async function startTopicPractice(input: {
  studentId: string;
  grade: number;
  assignment: ActiveAssignment;
}): Promise<
  | { ok: true; message: string; type: TopicPracticeAiResponse["type"] }
  | { ok: false; error: string }
> {
  const next = await getNextPracticeProblem(
    { id: input.studentId, grade: input.grade },
    {
      learningOutcome: input.assignment.learningOutcome,
      difficulty: asDifficulty(input.assignment.difficulty),
      strand: input.assignment.strand,
      subStrand: input.assignment.subStrand,
    },
  );
  if (!next.ok) return next;

  const topic = assignmentTopic(input.assignment);
  const persisted = await processAIResponse({
    parsed: {
      type: "problem",
      student_message: next.problem.problemText,
      detected_topic: topic.detected,
      problem_data: { expected_answer: next.problem.expectedAnswer },
    },
    studentId: input.studentId,
    mode: "topic_practice",
    assignmentId: input.assignment.id,
    detectedCbcNodeId: input.assignment.cbcNodeId,
    contentSource: next.problem.contentSource,
    cbcContentChunkId: next.problem.cbcContentChunkId,
    inboundMessage: "start",
    topic,
  });

  return { ok: true, message: persisted.studentMessage, type: "problem" };
}

export async function evaluateTopicPractice(input: {
  studentId: string;
  assignment: ActiveAssignment;
  pending: PendingPracticeProblem;
  inboundMessage: string;
}): Promise<
  | { ok: true; message: string; type: TopicPracticeAiResponse["type"] }
  | { ok: false; error: string }
> {
  const ctx = await topicPracticeContext(
    input.studentId,
    input.assignment,
    input.pending,
  );
  if (!ctx) return { ok: false, error: "Student not found." };

  if (!getAnthropicClient()) {
    return { ok: false, error: CLAUDE_NOT_CONFIGURED };
  }

  const topic = assignmentTopic(input.assignment);
  let parsed = await callPracticeClaude(ctx, input.inboundMessage);
  if (!parsed) {
    console.error("[kusoma] Practice Claude JSON invalid; retrying once.");
    parsed = await callPracticeClaude(ctx, input.inboundMessage);
  }
  if (!parsed) {
    console.error(
      "[kusoma] Practice Claude JSON invalid after retry; fallback message.",
    );
    parsed = fallbackAiResponse("topic_practice", topic.detected);
  }

  const persisted = await processAIResponse({
    parsed,
    studentId: input.studentId,
    mode: "topic_practice",
    assignmentId: input.assignment.id,
    detectedCbcNodeId: input.assignment.cbcNodeId,
    contentSource: input.pending.contentSource,
    cbcContentChunkId: input.pending.cbcContentChunkId,
    inboundMessage: input.inboundMessage,
    topic,
  });

  return { ok: true, message: persisted.studentMessage, type: parsed.type };
}
