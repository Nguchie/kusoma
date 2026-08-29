export const CBC_SEARCH_TIMEOUT_MS = 3_500;
export const CBC_CURRICULUM_TIMEOUT_MS = 5_000;

export type CbcErrorKind =
  | "not_configured"
  | "timeout"
  | "network"
  | "http"
  | "invalid_response";

export type CbcError = {
  kind: CbcErrorKind;
  message: string;
  status?: number;
};

export type CbcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CbcError };

export type CbcContentType = "exam_question" | "worked_example";

export type AssignmentDifficulty = "foundational" | "intermediate" | "advanced";

export type CurriculumSearchInput = {
  query: string;
  grade: number;
  subject: string;
  limit?: number;
};

export type ContentSearchInput = {
  query: string;
  grade: number;
  subject: string;
  content_type: CbcContentType;
  cognitive_level?: string;
  limit?: number;
};

