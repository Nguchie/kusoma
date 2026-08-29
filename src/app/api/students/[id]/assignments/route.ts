import { isUuid, jsonError, readJson, readString } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  createAssignment,
  listAssignmentsForStudent,
  parseDifficulty,
} from "@/server/services/assignments";

type RouteContext = { params: Promise<{ id: string }> };

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

  const cbcNodeId =
    readString(body, "cbc_node_id") ?? readString(body, "cbcNodeId");
  if (!cbcNodeId || !isUuid(cbcNodeId)) {
    return jsonError("cbc_node_id is required.", 400);
  }

  const difficulty = parseDifficulty(readString(body, "difficulty"));
  if (!difficulty) {
    return jsonError(
      "difficulty must be foundational, intermediate, or advanced.",
      400,
    );
  }

  const result = await createAssignment({
    tutorId: auth.tutor.id,
    studentId: id,
    cbcNodeId,
    difficulty,
    strand: readString(body, "strand"),
    subStrand: readString(body, "sub_strand") ?? readString(body, "subStrand"),
    learningOutcome:
      readString(body, "learning_outcome") ??
      readString(body, "learningOutcome"),
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.assignment, { status: 201 });
}
