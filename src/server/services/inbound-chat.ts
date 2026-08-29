import "server-only";

import type { AiResponse } from "@/lib/ai/types";
import {
  extractProblemTextFromImage,
  homeworkImageFromFile,
} from "@/lib/ai/vision";
import type { ChatMode } from "@/lib/messaging/types";
import { uploadHomeworkImage } from "@/lib/storage/homework-images";
import { getActiveStudentById } from "@/server/services/chat-identity";
import { insertInboundMessage } from "@/server/services/chat-messages";
import { prepareHomeworkHelp } from "@/server/services/homework-help";
import { processAIResponse } from "@/server/services/process-ai-response";
import {
  evaluateTopicPractice,
  getActiveAssignment,
  getPendingPracticeProblem,
  startTopicPractice,
} from "@/server/services/topic-practice";

const NO_ASSIGNMENT_START =
  "Your tutor hasn't assigned a practice topic yet. Send a homework problem if you need help.";

export type InboundChatOk = {
  ok: true;
  message: string;
  mode: ChatMode;
  type: AiResponse["type"];
};

export type InboundChatErr = {
  ok: false;
  error: string;
  status: number;
};

function isStartCommand(body: string): boolean {
  return body.trim().toLowerCase() === "start";
}

function errorStatus(error: string): number {
  if (error.includes("not found")) return 404;
  if (error.includes("Claude is not configured")) return 503;
  if (
    error.includes("Could not") ||
    error.includes("Send homework") ||
    error.includes("Use a JPEG")
  ) {
    return 400;
  }
  return 502;
}

async function handleHomework(input: {
  studentId: string;
  body: string;
  image: File | null;
  imagePath: string | null;
}): Promise<InboundChatOk | InboundChatErr> {
  const prepared = await prepareHomeworkHelp({
    studentId: input.studentId,
    problemText: input.body || undefined,
    image: input.body
      ? undefined
      : input.image
        ? await homeworkImageFromFile(input.image)
        : undefined,
    sourceImageUrl: input.imagePath ?? undefined,
  });
  if (!prepared.ok) {
    return {
      ok: false,
      error: prepared.error,
      status: errorStatus(prepared.error),
    };
  }

  const persisted = await processAIResponse({
    parsed: prepared.result.parsed,
    studentId: input.studentId,
    mode: "homework_help",
    assignmentId: null,
    detectedCbcNodeId: prepared.result.detectedCbcNodeId,
    contentSource: prepared.result.contentSource,
    cbcContentChunkId: prepared.result.cbcContentChunkId,
    inboundMessage: prepared.result.problemText,
    sourceImageUrl: input.imagePath ?? undefined,
    topic: prepared.result.topicDisplay,
  });

  return {
    ok: true,
    message: persisted.studentMessage,
    mode: "homework_help",
    type: prepared.result.parsed.type,
  };
}

/**
 * Spec §8 / implementation guide 2.14 — sync inbound routing.
 */
export async function handleInboundChat(input: {
  studentId: string;
  body: string;
  image: File | null;
}): Promise<InboundChatOk | InboundChatErr> {
  const student = await getActiveStudentById(input.studentId);
  if (!student) {
    return { ok: false, error: "Student not found.", status: 404 };
  }

  const assignment = await getActiveAssignment(student.id);
  const pending = assignment
    ? await getPendingPracticeProblem(student.id, assignment.id)
    : null;

  const start = isStartCommand(input.body) && !input.image;
  const mode: ChatMode =
    (assignment && pending) || start ? "topic_practice" : "homework_help";

  if (!input.body.trim() && !input.image) {
    return { ok: false, error: "Send a message or an image.", status: 400 };
  }

  let imagePath: string | null = null;
  if (input.image) {
    const uploaded = await uploadHomeworkImage(student.id, input.image);
    if (!uploaded.ok) {
      return { ok: false, error: uploaded.error, status: 400 };
    }
    imagePath = uploaded.path;
  }

  let inboundBody = input.body.trim();
  if (!inboundBody && input.image) {
    const extracted = await extractProblemTextFromImage(
      await homeworkImageFromFile(input.image),
    );
    if (!extracted.ok) {
      return {
        ok: false,
        error: extracted.error,
        status: errorStatus(extracted.error),
      };
    }
    inboundBody = extracted.problemText;
  }
  if (!inboundBody) {
    return { ok: false, error: "Send a message or an image.", status: 400 };
  }

  await insertInboundMessage({
    studentId: student.id,
    body: inboundBody,
    mode,
    assignmentId:
      assignment && mode === "topic_practice" ? assignment.id : null,
    imagePath,
  });

  if (assignment && pending) {
    const result = await evaluateTopicPractice({
      studentId: student.id,
      assignment,
      pending,
      inboundMessage: inboundBody,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        status: errorStatus(result.error),
      };
    }
    return {
      ok: true,
      message: result.message,
      mode: "topic_practice",
      type: result.type,
    };
  }

  if (assignment && start) {
    const result = await startTopicPractice({
      studentId: student.id,
      grade: student.grade,
      assignment,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        status: errorStatus(result.error),
      };
    }
    return {
      ok: true,
      message: result.message,
      mode: "topic_practice",
      type: result.type,
    };
  }

  if (start) {
    await processAIResponse({
      parsed: {
        type: "greeting",
        student_message: NO_ASSIGNMENT_START,
        detected_topic: { strand: "Mathematics", sub_strand: "General" },
      },
      studentId: student.id,
      mode: "topic_practice",
      assignmentId: null,
      detectedCbcNodeId: null,
      contentSource: "ai_generated",
      cbcContentChunkId: null,
      inboundMessage: inboundBody,
    });
    return {
      ok: true,
      message: NO_ASSIGNMENT_START,
      mode: "topic_practice",
      type: "greeting",
    };
  }

  return handleHomework({
    studentId: student.id,
    body: inboundBody,
    image: input.image,
    imagePath,
  });
}
