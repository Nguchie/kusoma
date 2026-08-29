import { isUuid, jsonError, readJson, readString } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  createAssignment,
  createAssignments,
  listAssignmentsForStudent,
  parseDifficulty,
} from "@/server/services/assignments";
import type { AssignmentDifficulty } from "@/lib/cbc/types";

type RouteContext = { params: Promise<{ id: string }> };

type TopicInput = {
  cbcNodeId: string;
  difficulty: AssignmentDifficulty;
  strand?: string;
  subStrand?: string;
  learningOutcome?: string;
};

function topicFromRecord(
  record: Record<string, unknown>,
  fallbackDifficulty?: AssignmentDifficulty,
): TopicInput | null {
  const cbcNodeId =
    readString(record, "cbc_node_id") ?? readString(record, "cbcNodeId");
  if (!cbcNodeId || !isUuid(cbcNodeId)) return null;
  const difficulty = parseDifficulty(
    readString(record, "difficulty") ?? fallbackDifficulty,
  );
  if (!difficulty) return null;
  return {
    cbcNodeId,
    difficulty,
    strand: readString(record, "strand"),
    subStrand:
      readString(record, "sub_strand") ?? readString(record, "subStrand"),
    learningOutcome:
      readString(record, "learning_outcome") ??
      readString(record, "learningOutcome"),
  };
}

function parseTopics(body: Record<string, unknown>): TopicInput[] | null {
  const fallback = parseDifficulty(readString(body, "difficulty")) ?? undefined;
  const raw = body.topics;
  if (Array.isArray(raw)) {
    const topics: TopicInput[] = [];
    for (const item of raw) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return null;
      }
      const topic = topicFromRecord(
        item as Record<string, unknown>,
        fallback,
      );
      if (!topic) return null;
      topics.push(topic);
    }
    return topics;
  }
  const single = topicFromRecord(body);
  return single ? [single] : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const items = await listAssignmentsForStudent(auth.tutor.id, id);
  if (!items) return jsonError("Student not found.", 404);
  return Response.json({ assignments: items });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const topics = parseTopics(body);
  if (!topics || topics.length === 0) {
    return jsonError("cbc_node_id is required.", 400);
  }

  if (topics.length === 1) {
    const result = await createAssignment({
      tutorId: auth.tutor.id,
      studentId: id,
      ...topics[0],
    });
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json(result.assignment, { status: 201 });
  }

  const result = await createAssignments({
    tutorId: auth.tutor.id,
    studentId: id,
    topics,
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json({ assignments: result.assignments }, { status: 201 });
}
