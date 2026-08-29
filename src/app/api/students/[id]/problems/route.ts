import { isUuid, jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  listStudentProblems,
  parseProblemMode,
} from "@/server/services/student-activity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const url = new URL(request.url);
  const modeRaw = url.searchParams.get("mode");
  let mode: "homework_help" | "topic_practice" | undefined;
  if (modeRaw) {
    const parsed = parseProblemMode(modeRaw);
    if (!parsed) {
      return jsonError("mode must be homework_help or topic_practice.", 400);
    }
    mode = parsed;
  }

  const items = await listStudentProblems(auth.tutor.id, id, mode);
  if (!items) return jsonError("Student not found.", 404);
  return Response.json({ problems: items });
}
