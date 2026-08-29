import type { AssignmentDifficulty } from "@/lib/cbc/types";

export type MessageDirection = "inbound" | "outbound";

export type ContentSource = "ai_generated" | "cbc_content";

export type StudentContext = {
  student: {
    firstName: string;
    grade: number;
  };
  tutor: {
    displayName: string;
  };
  performance: {
    recentTopics: Array<{
      strand: string;
      subStrand: string;
      totalProblems: number;
      correctCount: number;
      commonErrors: Array<{ type: string; detail: string; count: number }>;
    }>;
    streakDays: number;
  };
  recentMessages: Array<{
    direction: MessageDirection;
    body: string;
    createdAt: Date;
  }>;
};

export type HomeworkHelpContext = StudentContext & {
  mode: "homework_help";
  problemText: string;
  sourceImageUrl?: string;
  matchedNodes: Array<{
    strand: string;
    subStrand: string;
    learningOutcome: string;
    description: string | null;
  }>;
  referenceSolution?: {
    steps: Array<{
      stepNumber: number;
      action: string;
      explanation: string;
    }>;
  };
};

export type TopicPracticeContext = StudentContext & {
  mode: "topic_practice";
  assignment: {
    strand: string;
    subStrand: string;
    learningOutcome: string;
    difficulty: AssignmentDifficulty;
  };
  pendingProblem: {
    problemText: string;
    expectedAnswer: string;
    source: ContentSource;
  } | null;
};

export type DetectedTopic = {
  strand: string;
  sub_strand: string;
};

export type ErrorType =
  | "conceptual"
  | "computational"
  | "misread"
  | "none";

export type EvaluationData = {
  is_correct: boolean;
  error_type: ErrorType;
  error_detail: string;
};

export type ProblemData = {
  expected_answer: string;
};

export type HomeworkGuidanceResponse = {
  type: "homework_guidance";
  student_message: string;
  detected_topic: DetectedTopic;
  evaluation_data?: EvaluationData;
};

export type HomeworkEvaluationResponse = {
  type: "homework_evaluation";
  student_message: string;
  detected_topic: DetectedTopic;
  evaluation_data: EvaluationData;
};

export type HomeworkAiResponse =
  | HomeworkGuidanceResponse
  | HomeworkEvaluationResponse;

export type TopicPracticeProblemResponse = {
  type: "problem";
  student_message: string;
  detected_topic: DetectedTopic;
  problem_data: ProblemData;
};

export type TopicPracticeEvaluationResponse = {
  type: "evaluation";
  student_message: string;
  detected_topic: DetectedTopic;
  evaluation_data: EvaluationData;
};

export type TopicPracticeOtherResponse = {
  type: "response" | "greeting";
  student_message: string;
  detected_topic: DetectedTopic;
};

export type TopicPracticeAiResponse =
  | TopicPracticeProblemResponse
  | TopicPracticeEvaluationResponse
  | TopicPracticeOtherResponse;

export type AiResponse = HomeworkAiResponse | TopicPracticeAiResponse;
