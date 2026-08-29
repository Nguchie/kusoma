export type MatchedCurriculumNode = {
  id: string | null;
  strand: string;
  subStrand: string;
  learningOutcome: string;
  description: string | null;
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

function hitList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  for (const key of ["results", "data", "items", "matches", "nodes"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function parseCurriculumSearchHits(
  data: unknown,
): MatchedCurriculumNode[] {
  const nodes: MatchedCurriculumNode[] = [];
  for (const item of hitList(data)) {
    const record = asRecord(item);
    if (!record) continue;
    const nested = asRecord(record.node) ?? record;
    const strand = asString(nested.strand);
    const subStrand =
      asString(nested.subStrand) ?? asString(nested.sub_strand);
    const learningOutcome =
      asString(nested.learningOutcome) ??
      asString(nested.learning_outcome) ??
      asString(nested.title);
    if (!strand || !subStrand || !learningOutcome) continue;
    nodes.push({
      id: asString(nested.id) ?? asString(nested.node_id) ?? asString(record.id),
      strand,
      subStrand,
      learningOutcome,
      description:
        asString(nested.description) ?? asString(nested.teaching_approach),
    });
  }
  return nodes;
}
