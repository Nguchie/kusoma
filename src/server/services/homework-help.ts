import "server-only";

import {
  CLAUDE_MODEL,
  getAnthropicClient,
  parseJsonObject,
  textFromClaudeMessage,
} from "@/lib/ai/claude";
import {
  fallbackAiResponse,
  parseHomeworkAiResponse,
} from "@/lib/ai/parse-response";
import { homeworkHelpSystemPrompt } from "@/lib/ai/prompts";
import type {
  HomeworkAiResponse,
  HomeworkHelpContext,
} from "@/lib/ai/types";
import {
  extractProblemTextFromImage,
  type HomeworkImageInput,
} from "@/lib/ai/vision";
import {
  parseContentSearchHits,
  parseCurriculumSearchHits,
  searchContent,
  searchCurriculum,
} from "@/lib/cbc";
import { isUuid } from "@/server/http";
import { loadStudentContext } from "@/server/services/student-context";

export const WORKED_EXAMPLE_MIN_SIMILARITY = 0.75;

export type PrepareHomeworkHelpInput = {
  studentId: string;
  problemText?: string;
  image?: HomeworkImageInput;
  sourceImageUrl?: string;
};

export type HomeworkTopicDisplay = {
  strand: string;
  subStrand: string;
  learningOutcome: string;
};

export type PreparedHomeworkHelp = {
  context: HomeworkHelpContext;
  parsed: HomeworkAiResponse;
  problemText: string;
  cbcContentChunkId: string | null;
  contentSource: "cbc_content" | "ai_generated";
  detectedCbcNodeId: string | null;
  topicDisplay: HomeworkTopicDisplay | null;
};

async function callHomeworkClaude(
  ctx: HomeworkHelpContext,
): Promise<HomeworkAiResponse | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const lastInbound = [...ctx.recentMessages]
    .reverse()
    .find((row) => row.direction === "inbound");
  const user = lastInbound
    ? `The student's latest message:\n${lastInbound.body}\n\nRespond with the JSON object from the system prompt. No markdown.`
    : "The student sent only the problem, with no attempt yet. Respond with the JSON object from the system prompt. No markdown.";

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system: homeworkHelpSystemPrompt(ctx),
      messages: [{ role: "user", content: user }],
    });
    return parseHomeworkAiResponse(
      parseJsonObject(textFromClaudeMessage(message)),
    );
  } catch {
    return null;
  }
}

export async function prepareHomeworkHelp(
  input: PrepareHomeworkHelpInput,
): Promise<
  { ok: true; result: PreparedHomeworkHelp } | { ok: false; error: string }
> {
  const base = await loadStudentContext(input.studentId);
  if (!base) return { ok: false, error: "Student not found." };

  let problemText = input.problemText?.trim() ?? "";
  if (!problemText && input.image) {
    const extracted = await extractProblemTextFromImage(input.image);
    if (!extracted.ok) return extracted;
    problemText = extracted.problemText;
  }
  if (!problemText) {
    return { ok: false, error: "Send homework text or an image." };
  }

  if (!getAnthropicClient()) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not set." };
  }

  const curriculum = await searchCurriculum({
    query: problemText,
    grade: base.student.grade,
    subject: "mathematics",
    limit: 3,
  });
  const curriculumHits = curriculum.ok
    ? parseCurriculumSearchHits(curriculum.data)
    : [];
  const matchedNodes = curriculumHits.slice(0, 3).map((node) => ({
    strand: node.strand,
    subStrand: node.subStrand,
    learningOutcome: node.learningOutcome,
    description: node.description,
  }));
  const primaryHit =
    curriculumHits.find((node) => node.id && isUuid(node.id)) ??
    curriculumHits[0] ??
    null;
  const detectedCbcNodeId =
    primaryHit?.id && isUuid(primaryHit.id) ? primaryHit.id : null;
  const topicDisplay: HomeworkTopicDisplay | null = primaryHit
    ? {
        strand: primaryHit.strand,
        subStrand: primaryHit.subStrand,
        learningOutcome: primaryHit.learningOutcome,
      }
    : null;

  const worked = await searchContent({
    query: problemText,
    grade: base.student.grade,
    subject: "mathematics",
    content_type: "worked_example",
    limit: 1,
  });

  let referenceSolution: HomeworkHelpContext["referenceSolution"];
  let cbcContentChunkId: string | null = null;
  if (worked.ok) {
    const hit = parseContentSearchHits(worked.data)[0];
    if (
      hit?.steps &&
      hit.similarity !== null &&
      hit.similarity >= WORKED_EXAMPLE_MIN_SIMILARITY
    ) {
      referenceSolution = { steps: hit.steps };
      cbcContentChunkId = hit.id;
    }
  }

  const context: HomeworkHelpContext = {
    ...base,
    mode: "homework_help",
    problemText,
    sourceImageUrl: input.sourceImageUrl,
    matchedNodes,
    referenceSolution,
  };

  let parsed = await callHomeworkClaude(context);
  if (!parsed) {
    console.error("[kusoma] Homework Claude JSON invalid; retrying once.");
    parsed = await callHomeworkClaude(context);
  }
  if (!parsed) {
    console.error(
      "[kusoma] Homework Claude JSON invalid after retry; fallback message.",
    );
    parsed = fallbackAiResponse(
      "homework_help",
      topicDisplay
        ? { strand: topicDisplay.strand, sub_strand: topicDisplay.subStrand }
        : undefined,
    );
  }

  return {
    ok: true,
    result: {
      context,
      parsed,
      problemText,
      cbcContentChunkId,
      contentSource: cbcContentChunkId ? "cbc_content" : "ai_generated",
      detectedCbcNodeId,
      topicDisplay,
    },
  };
}
