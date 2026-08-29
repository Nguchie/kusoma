import type {
  AiResponse,
  DetectedTopic,
  ErrorType,
  EvaluationData,
  HomeworkAiResponse,
  ProblemData,
  TopicPracticeAiResponse,
} from "@/lib/ai/types";

export const FALLBACK_STUDENT_MESSAGE =
  "I had trouble reading that. Please send the problem again in a short message.";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDetectedTopic(raw: unknown): DetectedTopic | null {
  const record = asRecord(raw);
  if (!record) return null;
  const strand = asString(record.strand);
  const subStrand =
    asString(record.sub_strand) ?? asString(record.subStrand);
  if (!strand || !subStrand) return null;
  return { strand, sub_strand: subStrand };
}

function parseErrorType(raw: unknown): ErrorType | null {
  if (
    raw === "conceptual" ||
    raw === "computational" ||
    raw === "misread" ||
    raw === "none"
  ) {
    return raw;
  }
  return null;
}

function parseEvaluationData(raw: unknown): EvaluationData | null {
  const record = asRecord(raw);
  if (!record) return null;
  const errorType = parseErrorType(record.error_type);
  const detail = asString(record.error_detail);
  if (typeof record.is_correct !== "boolean" || !errorType || !detail) {
    return null;
  }
  return {
    is_correct: record.is_correct,
    error_type: errorType,
    error_detail: detail,
  };
}

export function parseHomeworkAiResponse(
  raw: unknown,
): HomeworkAiResponse | null {
  const record = asRecord(raw);
  if (!record) return null;
  const studentMessage = asString(record.student_message);
  const detected = parseDetectedTopic(record.detected_topic);
  if (!studentMessage || !detected) return null;

  if (record.type === "homework_guidance") {
    return {
      type: "homework_guidance",
      student_message: studentMessage,
      detected_topic: detected,
      evaluation_data: parseEvaluationData(record.evaluation_data) ?? undefined,
    };
  }

  if (record.type === "homework_evaluation") {
    const evaluation = parseEvaluationData(record.evaluation_data);
    if (!evaluation) return null;
    return {
      type: "homework_evaluation",
      student_message: studentMessage,
      detected_topic: detected,
      evaluation_data: evaluation,
    };
  }

  return null;
}

function parseProblemData(raw: unknown): ProblemData | null {
  const record = asRecord(raw);
  if (!record) return null;
  const expected = asString(record.expected_answer);
  if (!expected) return null;
  return { expected_answer: expected };
}

export function parseTopicPracticeAiResponse(
  raw: unknown,
): TopicPracticeAiResponse | null {
  const record = asRecord(raw);
  if (!record) return null;
  const studentMessage = asString(record.student_message);
  const detected = parseDetectedTopic(record.detected_topic);
  if (!studentMessage || !detected) return null;

  if (record.type === "problem") {
    const problemData = parseProblemData(record.problem_data);
    if (!problemData) return null;
    return {
      type: "problem",
      student_message: studentMessage,
      detected_topic: detected,
      problem_data: problemData,
    };
  }

  if (record.type === "evaluation") {
    const evaluation = parseEvaluationData(record.evaluation_data);
    if (!evaluation) return null;
    return {
      type: "evaluation",
      student_message: studentMessage,
      detected_topic: detected,
      evaluation_data: evaluation,
    };
  }

  if (record.type === "response" || record.type === "greeting") {
    return {
      type: record.type,
      student_message: studentMessage,
      detected_topic: detected,
    };
  }

  return null;
}

export function parseAiResponse(raw: unknown): AiResponse | null {
  return parseHomeworkAiResponse(raw) ?? parseTopicPracticeAiResponse(raw);
}

export function fallbackAiResponse(
  mode: "homework_help",
  detectedTopic?: DetectedTopic,
): HomeworkAiResponse;
export function fallbackAiResponse(
  mode: "topic_practice",
  detectedTopic?: DetectedTopic,
): TopicPracticeAiResponse;
export function fallbackAiResponse(
  mode: "homework_help" | "topic_practice",
  detectedTopic?: DetectedTopic,
): AiResponse {
  const topic = detectedTopic ?? {
    strand: "Mathematics",
    sub_strand: "General",
  };
  if (mode === "homework_help") {
    return {
      type: "homework_guidance",
      student_message: FALLBACK_STUDENT_MESSAGE,
      detected_topic: topic,
    };
  }
  return {
    type: "response",
    student_message: FALLBACK_STUDENT_MESSAGE,
    detected_topic: topic,
  };
}

export function parseAiResponseOrFallback(
  raw: unknown,
  mode: "homework_help" | "topic_practice",
  detectedTopic?: DetectedTopic,
): AiResponse {
  const parsed = parseAiResponse(raw);
  if (parsed) return parsed;
  console.error(
    "[kusoma] Claude JSON parse failed; using fallback student message.",
  );
  if (mode === "homework_help") {
    return fallbackAiResponse("homework_help", detectedTopic);
  }
  return fallbackAiResponse("topic_practice", detectedTopic);
}
