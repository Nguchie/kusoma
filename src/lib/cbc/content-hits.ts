export type CbcWorkedExampleStep = {
  stepNumber: number;
  action: string;
  explanation: string;
};

export type CbcContentHit = {
  id: string;
  body: string;
  answer: string | null;
  similarity: number | null;
  steps: CbcWorkedExampleStep[] | null;
};

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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function hitList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  for (const key of ["results", "data", "items", "chunks", "matches"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function parseSteps(raw: unknown): CbcWorkedExampleStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const steps: CbcWorkedExampleStep[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const action = asString(record.action);
    const explanation = asString(record.explanation) ?? "";
    if (!action) continue;
    const stepNumber =
      asNumber(record.stepNumber) ?? asNumber(record.step_number) ?? steps.length + 1;
    steps.push({ stepNumber, action, explanation });
  }
  return steps.length > 0 ? steps : null;
}

export function parseContentSearchHits(data: unknown): CbcContentHit[] {
  const hits: CbcContentHit[] = [];
  for (const item of hitList(data)) {
    const record = asRecord(item);
    if (!record) continue;
    const id = asString(record.id) ?? asString(record.chunk_id);
    const body =
      asString(record.body) ??
      asString(record.text) ??
      asString(record.question) ??
      asString(record.content);
    if (!id || !body) continue;
    hits.push({
      id,
      body,
      answer:
        asString(record.answer) ??
        asString(record.expected_answer) ??
        asString(record.marking_scheme_answer),
      similarity: asNumber(record.similarity) ?? asNumber(record.score),
      steps: parseSteps(record.steps),
    });
  }
  return hits;
}
