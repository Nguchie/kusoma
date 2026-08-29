import { isUuid, jsonError, readJson, readString } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  parseAssignmentStatus,
  parseDifficulty,
  updateAssignment,
} from "@/server/services/assignments";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid assignment id.", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  let difficulty: ReturnType<typeof parseDifficulty> | undefined;
  if ("difficulty" in body) {
    difficulty = parseDifficulty(readString(body, "difficulty"));
    if (!difficulty) {
      return jsonError(
        "difficulty must be foundational, intermediate, or advanced.",
        400,
      );
    }
  }

  let status: ReturnType<typeof parseAssignmentStatus> | undefined;
  if ("status" in body) {
    status = parseAssignmentStatus(readString(body, "status"));
    if (!status) {
      return jsonError("status must be active, completed, or paused.", 400);
    }
  }

  let tutorNotes: string | null | undefined;
  if ("tutor_notes" in body || "notes" in body) {
    tutorNotes =
      readString(body, "tutor_notes") ?? readString(body, "notes") ?? null;
  }

  const result = await updateAssignment({
    tutorId: auth.tutor.id,
    assignmentId: id,
    difficulty: difficulty ?? undefined,
    status: status ?? undefined,
    tutorNotes,
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.assignment);
}
