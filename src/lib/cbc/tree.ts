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
    if (Array.isArray(value)) return value;
  }
  return [];
}

function titleOf(record: Record<string, unknown>, extras: string[] = []): string | null {
  for (const key of [
    ...extras,
    "title",
    "name",
    "label",
    "learning_outcome",
    "learningOutcome",
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
  return (
    asString(record.id) ??
    asString(record.node_id) ??
    asString(record.nodeId) ??
    asString(record.uuid) ??
    asString(record.cbc_node_id) ??
    asString(record.cbcNodeId)
  );
}

const CHILD_KEYS = [
  "strands",
  "sub_strands",
  "subStrands",
  "learning_outcomes",
  "learningOutcomes",
  "outcomes",
  "children",
  "nodes",
  "items",
  "results",
] as const;

type RawNode = {
  id: string | null;
  title: string;
  description: string | null;
  children: RawNode[];
};

function parseRawNode(item: unknown): RawNode | null {
  const record = asRecord(item);
  if (!record) return null;
  const nested = asRecord(record.node) ?? record;
  const children = firstArray(nested, [...CHILD_KEYS])
    .map(parseRawNode)
    .filter((node): node is RawNode => node !== null);
  const title = titleOf(nested) ?? titleOf(record);
  if (!title && children.length === 0) return null;
  return {
    id: idOf(nested) ?? idOf(record),
    title: title ?? "Topic",
    description:
      asString(nested.description) ?? asString(nested.teaching_approach),
    children,
  };
}

function rootRecord(data: unknown): Record<string, unknown> | null {
  const record = asRecord(data);
  if (!record) return null;
  const nested =
    asRecord(record.data) ?? asRecord(record.curriculum) ?? record;
  return nested;
}

function collectRaw(data: unknown): RawNode[] {
  const root = rootRecord(data);
  if (!root) return [];
  const fromList = firstArray(root, [...CHILD_KEYS])
    .map(parseRawNode)
    .filter((node): node is RawNode => node !== null);
  if (fromList.length > 0) return fromList;
  const single = parseRawNode(root);
  if (!single) return [];
  return single.children.length > 0 ? single.children : [single];
}

function depthOf(nodes: RawNode[]): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(0, ...nodes.map((node) => depthOf(node.children)));
}

function asOutcomes(nodes: RawNode[]): CurriculumOutcome[] {
  const outcomes: CurriculumOutcome[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      outcomes.push(...asOutcomes(node.children));
      continue;
    }
    if (!node.id) continue;
    outcomes.push({
      id: node.id,
      title: node.title,
      description: node.description,
    });
  }
  return outcomes;
}

function toStrands(nodes: RawNode[], subject: string): CurriculumStrand[] {
  const depth = depthOf(nodes);
  if (depth <= 1) {
    const outcomes = asOutcomes(nodes);
    if (outcomes.length === 0) return [];
    return [
      {
        id: null,
        title: subject.charAt(0).toUpperCase() + subject.slice(1),
        subStrands: [{ id: null, title: "Topics", outcomes }],
      },
    ];
  }

  if (depth === 2) {
    return nodes
      .map((strand) => {
        const outcomes = asOutcomes(strand.children);
        const fallback =
          strand.id && outcomes.length === 0
            ? [
                {
                  id: strand.id,
                  title: strand.title,
                  description: strand.description,
                },
              ]
            : outcomes;
        if (fallback.length === 0) return null;
        return {
          id: strand.id,
          title: strand.title,
          subStrands: [
            {
              id: strand.id,
              title: strand.title,
              outcomes: fallback,
            },
          ],
        };
      })
      .filter((row): row is CurriculumStrand => row !== null);
  }

  return nodes
    .map((strand) => {
      const subStrands: CurriculumSubStrand[] = strand.children.map((sub) => {
        const outcomes =
          sub.children.length > 0
            ? asOutcomes(sub.children)
            : sub.id
              ? [
                  {
                    id: sub.id,
                    title: sub.title,
                    description: sub.description,
                  },
                ]
              : [];
        return { id: sub.id, title: sub.title, outcomes };
      });
      const usable = subStrands.filter((sub) => sub.outcomes.length > 0);
      if (usable.length === 0 && strand.id) {
        return {
          id: strand.id,
          title: strand.title,
          subStrands: [
            {
              id: strand.id,
              title: strand.title,
              outcomes: [
                {
                  id: strand.id,
                  title: strand.title,
                  description: strand.description,
                },
              ],
            },
          ],
        };
      }
      if (usable.length === 0) return null;
      return { id: strand.id, title: strand.title, subStrands: usable };
    })
    .filter((row): row is CurriculumStrand => row !== null);
}

export function parseCurriculumTree(
  data: unknown,
  fallback: { grade: number; subject: string },
): CurriculumTree {
  const root = rootRecord(data);
  const strands = toStrands(collectRaw(data), fallback.subject);
  const gradeValue = root?.grade;
  const grade =
    typeof gradeValue === "number" && Number.isInteger(gradeValue)
      ? gradeValue
      : fallback.grade;
  const subject =
    (root ? asString(root.subject) : null) ?? fallback.subject;

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
