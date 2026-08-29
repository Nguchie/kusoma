import { isUuid, jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { listTopicPerformance } from "@/server/services/student-activity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const items = await listTopicPerformance(auth.tutor.id, id);
  if (!items) return jsonError("Student not found.", 404);
  return Response.json({ performance: items });
}
