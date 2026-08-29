import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import type {
  AiResponse,
  ContentSource,
  EvaluationData,
} from "@/lib/ai/types";
import { db } from "@/lib/db";
import {
  messages,
  practiceProblems,
  studentPerformance,
} from "@/lib/db/schema";
import { getMessagingClient } from "@/lib/messaging";
import type { ChatMode } from "@/lib/messaging/types";
import {
  parseCommonErrors,
  type CommonError,
} from "@/server/services/student-context";

const COMMON_ERRORS_CAP = 10;

export type TopicDisplay = {
  strand: string;
  subStrand: string;
  learningOutcome: string;
};

export type ProcessAiResponseInput = {
  parsed: AiResponse;
  studentId: string;
  mode: ChatMode;
  assignmentId: string | null;
  detectedCbcNodeId: string | null;
  contentSource: ContentSource;
  cbcContentChunkId: string | null;
  inboundMessage: string;
  sourceImageUrl?: string;
  topic?: TopicDisplay | null;
  /**
   * Worker / nudge paths: persist via MessagingClient.
   * HTTP `/api/chat/message` leaves this false — the JSON body is the live reply.
   */
  deliver?: boolean;
  toPhone?: string;
};

export type ProcessAiResponseResult = {
  studentMessage: string;
  problemId: string | null;
  performanceId: string | null;
};

function nairobiDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function nextStreak(
  lastActiveAt: Date | string | null,
  current: number,
  now: Date,
): number {
  if (!lastActiveAt) return 1;
  const last =
    lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);
  if (Number.isNaN(last.getTime())) return 1;
  const lastKey = nairobiDateKey(last);
  const todayKey = nairobiDateKey(now);
  if (lastKey === todayKey) return Math.max(current, 1);
  const lastMs = Date.parse(`${lastKey}T00:00:00+03:00`);
  const todayMs = Date.parse(`${todayKey}T00:00:00+03:00`);
  const diffDays = Math.round((todayMs - lastMs) / 86_400_000);
  if (diffDays === 1) return current + 1;
  return 1;
}

function topicFromParsed(
  parsed: AiResponse,
  topic?: TopicDisplay | null,
): TopicDisplay {
  return {
    strand: topic?.strand || parsed.detected_topic.strand,
    subStrand: topic?.subStrand || parsed.detected_topic.sub_strand,
    learningOutcome:
      topic?.learningOutcome || parsed.detected_topic.sub_strand,
  };
}

function expectedAnswerFromParsed(parsed: AiResponse): string | null {
  if (parsed.type === "problem") return parsed.problem_data.expected_answer;
  return null;
}

function evaluationFromParsed(parsed: AiResponse): EvaluationData | null {
  if (parsed.type === "evaluation" || parsed.type === "homework_evaluation") {
    return parsed.evaluation_data;
  }
  return null;
}

function mergeCommonErrors(
  existing: CommonError[],
  evaluation: EvaluationData,
): CommonError[] {
  if (evaluation.is_correct || evaluation.error_type === "none") {
    return existing.slice(0, COMMON_ERRORS_CAP);
  }
  const next = existing.map((item) => ({ ...item }));
  const match = next.find(
    (item) =>
      item.type === evaluation.error_type &&
      item.detail === evaluation.error_detail,
  );
  if (match) {
    match.count += 1;
  } else {
    next.push({
      type: evaluation.error_type,
      detail: evaluation.error_detail,
      count: 1,
    });
  }
  return next
    .sort((a, b) => b.count - a.count)
    .slice(0, COMMON_ERRORS_CAP);
}

async function insertOutboundMessage(input: ProcessAiResponseInput) {
  const body = input.parsed.student_message.trim();
  if (input.deliver) {
    if (!input.toPhone) {
      throw new Error("[kusoma] deliver=true requires toPhone.");
    }
    await getMessagingClient().sendText(input.toPhone, body, {
      studentId: input.studentId,
      mode: input.mode,
      assignmentId: input.assignmentId,
    });
    return;
  }

  await db.insert(messages).values({
    studentId: input.studentId,
    assignmentId: input.assignmentId,
    mode: input.mode,
    direction: "outbound",
    contentType: "text",
    body,
    channel: "web_chat",
  });
}

async function insertProblem(
  input: ProcessAiResponseInput,
  extras?: {
    studentAnswer?: string;
    evaluation?: EvaluationData;
    attemptedAt?: Date;
  },
): Promise<string | null> {
  const problemText =
    input.mode === "homework_help"
      ? input.inboundMessage
      : input.parsed.student_message;
  const evaluation = extras?.evaluation;

  const [row] = await db
    .insert(practiceProblems)
    .values({
      studentId: input.studentId,
      assignmentId: input.assignmentId,
      detectedCbcNodeId: input.detectedCbcNodeId,
      mode: input.mode,
      contentSource: input.contentSource,
      cbcContentChunkId: input.cbcContentChunkId,
      problemText,
      expectedAnswer: expectedAnswerFromParsed(input.parsed),
      sourceImageUrl: input.sourceImageUrl ?? null,
      studentAnswer: extras?.studentAnswer ?? null,
      isCorrect: evaluation?.is_correct ?? null,
      errorType: evaluation?.error_type ?? null,
      errorDetail: evaluation?.error_detail ?? null,
      aiExplanation: evaluation ? input.parsed.student_message : null,
      attemptedAt: extras?.attemptedAt ?? null,
    })
    .returning({ id: practiceProblems.id });

  return row?.id ?? null;
}

async function updateLatestProblem(
  input: ProcessAiResponseInput,
  evaluation: EvaluationData,
): Promise<string | null> {
  const [latest] = await db
    .select({ id: practiceProblems.id })
    .from(practiceProblems)
    .where(
      and(
        eq(practiceProblems.studentId, input.studentId),
        eq(practiceProblems.mode, input.mode),
        isNull(practiceProblems.studentAnswer),
      ),
    )
    .orderBy(desc(practiceProblems.createdAt))
    .limit(1);

  if (!latest) return null;

  await db
    .update(practiceProblems)
    .set({
      studentAnswer: input.inboundMessage,
      isCorrect: evaluation.is_correct,
      errorType: evaluation.error_type,
      errorDetail: evaluation.error_detail,
      aiExplanation: input.parsed.student_message,
      attemptedAt: new Date(),
    })
    .where(eq(practiceProblems.id, latest.id));

  return latest.id;
}

async function upsertPerformance(input: {
  studentId: string;
  cbcNodeId: string;
  assignmentId: string | null;
  topic: TopicDisplay;
  incrementTotal: boolean;
  evaluation: EvaluationData | null;
}): Promise<string> {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(studentPerformance)
    .where(
      and(
        eq(studentPerformance.studentId, input.studentId),
        eq(studentPerformance.cbcNodeId, input.cbcNodeId),
      ),
    )
    .limit(1);

  const incrementCorrect = Boolean(input.evaluation?.is_correct);
  const errors = input.evaluation
    ? mergeCommonErrors(
        existing ? parseCommonErrors(existing.commonErrors) : [],
        input.evaluation,
      )
    : existing
      ? parseCommonErrors(existing.commonErrors)
      : [];

  if (!existing) {
    const [row] = await db
      .insert(studentPerformance)
      .values({
        studentId: input.studentId,
        cbcNodeId: input.cbcNodeId,
        strand: input.topic.strand,
        subStrand: input.topic.subStrand,
        learningOutcome: input.topic.learningOutcome,
        assignmentId: input.assignmentId,
        totalProblems: input.incrementTotal ? 1 : 0,
        correctCount: incrementCorrect ? 1 : 0,
        commonErrors: errors,
        streakDays: 1,
        lastActiveAt: now,
        updatedAt: now,
      })
      .returning({ id: studentPerformance.id });
    return row!.id;
  }

  const [row] = await db
    .update(studentPerformance)
    .set({
      strand: input.topic.strand,
      subStrand: input.topic.subStrand,
      learningOutcome: input.topic.learningOutcome,
      assignmentId: input.assignmentId ?? existing.assignmentId,
      totalProblems: existing.totalProblems + (input.incrementTotal ? 1 : 0),
      correctCount: existing.correctCount + (incrementCorrect ? 1 : 0),
      commonErrors: errors,
      streakDays: nextStreak(existing.lastActiveAt, existing.streakDays, now),
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(studentPerformance.id, existing.id))
    .returning({ id: studentPerformance.id });

  return row!.id;
}

/**
 * Persist one Claude turn: outbound message, practice problem, performance.
 * Spec §7.2 / implementation guide 2.13.
 */
export async function processAIResponse(
  input: ProcessAiResponseInput,
): Promise<ProcessAiResponseResult> {
  await insertOutboundMessage(input);

  const isNewProblem =
    input.parsed.type === "problem" ||
    input.parsed.type === "homework_guidance";
  const evaluation = evaluationFromParsed(input.parsed);

  let problemId: string | null = null;
  let incrementTotal = false;
  if (isNewProblem) {
    problemId = await insertProblem(input);
    incrementTotal = true;
  } else if (evaluation) {
    problemId = await updateLatestProblem(input, evaluation);
    if (!problemId) {
      problemId = await insertProblem(input, {
        studentAnswer: input.inboundMessage,
        evaluation,
        attemptedAt: new Date(),
      });
      incrementTotal = true;
    }
  }

  let performanceId: string | null = null;
  if (input.detectedCbcNodeId) {
    performanceId = await upsertPerformance({
      studentId: input.studentId,
      cbcNodeId: input.detectedCbcNodeId,
      assignmentId: input.assignmentId,
      topic: topicFromParsed(input.parsed, input.topic),
      incrementTotal,
      evaluation,
    });
  }

  return {
    studentMessage: input.parsed.student_message,
    problemId,
    performanceId,
  };
}
