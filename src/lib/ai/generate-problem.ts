import "server-only";

import type { AssignmentDifficulty } from "@/lib/cbc/types";
import {
  CLAUDE_NOT_CONFIGURED,
  claudeModel,
  getAnthropicClient,
  parseJsonObject,
  textFromClaudeMessage,
} from "@/lib/ai/claude";

export type GeneratedPracticeProblem = {
  problemText: string;
  expectedAnswer: string;
};

export async function generatePracticeProblem(input: {
  grade: number;
  strand: string;
  subStrand: string;
  learningOutcome: string;
  difficulty: AssignmentDifficulty;
}): Promise<
  { ok: true; problem: GeneratedPracticeProblem } | { ok: false; error: string }
> {
  const client = getAnthropicClient();
  if (!client) {
    return { ok: false, error: CLAUDE_NOT_CONFIGURED };
  }

  const user = `Generate one Grade ${input.grade} mathematics practice problem for Kenya's CBC curriculum.
Assigned topic: ${input.strand} > ${input.subStrand}
Learning outcome: ${input.learningOutcome}
Difficulty: ${input.difficulty}

Do NOT include the answer in the problem text. Keep the problem short (chat).
Respond with valid JSON only:
{"student_message":"<problem text>","problem_data":{"expected_answer":"..."}}`;

  try {
    const message = await client.messages.create({
      model: claudeModel(),
      max_tokens: 600,
      messages: [{ role: "user", content: user }],
    });
    const parsed = parseJsonObject(textFromClaudeMessage(message));
    const problemText =
      typeof parsed?.student_message === "string"
        ? parsed.student_message.trim()
        : "";
    const problemData =
      parsed?.problem_data &&
      typeof parsed.problem_data === "object" &&
      parsed.problem_data !== null &&
      !Array.isArray(parsed.problem_data)
        ? (parsed.problem_data as Record<string, unknown>)
        : null;
    const expectedAnswer =
      typeof problemData?.expected_answer === "string"
        ? problemData.expected_answer.trim()
        : "";
    if (!problemText || !expectedAnswer) {
      return { ok: false, error: "Claude did not return a usable problem." };
    }
    return { ok: true, problem: { problemText, expectedAnswer } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude request failed.";
    return { ok: false, error: message };
  }
}
