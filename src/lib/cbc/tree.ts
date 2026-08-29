export const CURRICULUM_UNAVAILABLE =
  "Curriculum data is temporarily unavailable — try again in a moment";

export type CurriculumOutcome = {
  id: string;
  title: string;
  description: string | null;
};

export type CurriculumSubStrand = {
  id: string | null;
  title: string;
  outcomes: CurriculumOutcome[];
};

export type CurriculumStrand = {
  id: string | null;
  title: string;
  subStrands: CurriculumSubStrand[];
};

export type CurriculumTree = {
  grade: number;
  subject: string;
  strands: CurriculumStrand[];
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

function firstArray(
  record: Record<string, unknown>,
  keys: string[],
): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function titleOf(
  record: Record<string, unknown>,
  extras: string[] = [],
): string | null {
  for (const key of [
    ...extras,
    "title",
    "name",
    "label",
    "learning_outcome",
    "learningOutcome",
    "outcome",
    "sub_strand",
    "subStrand",
    "strand",
  ]) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function idOf(record: Record<string, unknown>): string | null {
  const direct =
    asString(record.id) ??
    asString(record.node_id) ??
    asString(record.nodeId) ??
    asString(record.uuid) ??
    asString(record.cbc_node_id) ??
    asString(record.cbcNodeId);
  if (direct) return direct;
  if (typeof record.id === "number" && Number.isFinite(record.id)) {
    return String(record.id);
  }
  return null;
}

const NEST_KEYS = [
  "learning_outcomes",
  "learningOutcomes",
  "specific_learning_outcomes",
  "specificLearningOutcomes",
  "outcomes",
  "topics",
  "sub_topics",
  "subTopics",
  "indicators",
  "children",
  "nodes",
  "items",
] as const;

function parseOutcomes(raw: unknown[]): CurriculumOutcome[] {
  const outcomes: CurriculumOutcome[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const nested = asRecord(record.node) ?? record;
    const nestedChildren = firstArray(nested, [...NEST_KEYS]);
    if (nestedChildren.length > 0) {
      const inner = parseOutcomes(nestedChildren);
      if (inner.length > 0) {
        outcomes.push(...inner);
        continue;
      }
    }
    const id = idOf(nested) ?? idOf(record);
    const title = titleOf(nested, [
      "learning_outcome",
      "learningOutcome",
      "outcome",
    ]);
    if (!id || !title) continue;
    outcomes.push({
      id,
      title,
      description:
        asString(nested.description) ?? asString(nested.teaching_approach),
    });
  }
  return outcomes;
}

function parseSubStrands(raw: unknown[]): CurriculumSubStrand[] {
  const subs: CurriculumSubStrand[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const nested = asRecord(record.node) ?? record;
    const title = titleOf(nested, ["sub_strand", "subStrand"]);
    const outcomes = parseOutcomes(
      firstArray(nested, [...NEST_KEYS, "sub_strands", "subStrands"]),
    );
    if (!title && outcomes.length === 0) continue;
    subs.push({
      id: idOf(nested) ?? idOf(record),
      title: title ?? "Sub-strand",
      outcomes,
    });
  }
  return subs;
}

function parseStrands(raw: unknown[]): CurriculumStrand[] {
  const strands: CurriculumStrand[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const nested = asRecord(record.node) ?? record;
    const title = titleOf(nested, ["strand"]);
    const subStrands = parseSubStrands(
      firstArray(nested, [
        "sub_strands",
        "subStrands",
        "children",
        "nodes",
      ]),
    );
    if (!title && subStrands.length === 0) continue;
    strands.push({
      id: idOf(nested) ?? idOf(record),
      title: title ?? "Strand",
      subStrands,
    });
  }
  return strands;
}

function rootRecord(data: unknown): Record<string, unknown> | null {
  const record = asRecord(data);
  if (!record) return null;
  const nested =
    asRecord(record.data) ?? asRecord(record.curriculum) ?? record;
  return nested;
}

export function parseCurriculumTree(
  data: unknown,
  fallback: { grade: number; subject: string },
): CurriculumTree {
  const root = rootRecord(data);
  const strands = root
    ? parseStrands(
        firstArray(root, ["strands", "children", "nodes", "items", "results"]),
      )
    : [];

  const gradeValue = root?.grade;
  const grade =
    typeof gradeValue === "number" && Number.isInteger(gradeValue)
      ? gradeValue
      : fallback.grade;
  const subject = (root ? asString(root.subject) : null) ?? fallback.subject;

  return { grade, subject, strands };
}

export function parseCbcNodeDisplay(data: unknown): {
  id: string | null;
  strand: string;
  subStrand: string;
  learningOutcome: string;
} | null {
  const record = asRecord(data);
  if (!record) return null;
  const nested =
    asRecord(record.node) ?? asRecord(record.data) ?? record;

  const strandRecord = asRecord(nested.strand);
  const subRecord =
    asRecord(nested.sub_strand) ?? asRecord(nested.subStrand);

  const strand =
    asString(nested.strand) ??
    (strandRecord ? titleOf(strandRecord) : null);
  const subStrand =
    asString(nested.sub_strand) ??
    asString(nested.subStrand) ??
    (subRecord ? titleOf(subRecord) : null);
  const learningOutcome =
    asString(nested.learning_outcome) ??
    asString(nested.learningOutcome) ??
    asString(nested.outcome) ??
    asString(nested.title) ??
    asString(nested.name);

  if (!strand || !subStrand || !learningOutcome) return null;

  return {
    id: idOf(nested) ?? idOf(record),
    strand,
    subStrand,
    learningOutcome,
  };
}
