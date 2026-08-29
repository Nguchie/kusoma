export { CLAUDE_MODEL, getAnthropicClient } from "./claude";
export { generatePracticeProblem } from "./generate-problem";
export {
  FALLBACK_STUDENT_MESSAGE,
  fallbackAiResponse,
  parseAiResponse,
  parseAiResponseOrFallback,
  parseHomeworkAiResponse,
  parseTopicPracticeAiResponse,
} from "./parse-response";
export {
  homeworkHelpSystemPrompt,
  topicPracticeSystemPrompt,
} from "./prompts";
export {
  extractProblemTextFromImage,
  homeworkImageFromFile,
  type HomeworkImageInput,
} from "./vision";
export type {
  AiResponse,
  ContentSource,
  DetectedTopic,
  ErrorType,
  EvaluationData,
  HomeworkAiResponse,
  HomeworkEvaluationResponse,
  HomeworkGuidanceResponse,
  HomeworkHelpContext,
  MessageDirection,
  ProblemData,
  StudentContext,
  TopicPracticeAiResponse,
  TopicPracticeContext,
  TopicPracticeEvaluationResponse,
  TopicPracticeOtherResponse,
  TopicPracticeProblemResponse,
} from "./types";
