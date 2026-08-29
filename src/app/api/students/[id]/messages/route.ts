import { isUuid, jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  listTutorStudentMessages,
  parseMessagesBefore,
  parseTutorMessageLimit,
} from "@/server/services/chat-messages";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const url = new URL(request.url);
  const before = parseMessagesBefore(url.searchParams.get("before"));
  if (url.searchParams.get("before") && !before) {
    return jsonError("before must be an ISO timestamp.", 400);
  }

  const result = await listTutorStudentMessages(auth.tutor.id, id, {
    limit: parseTutorMessageLimit(url.searchParams.get("limit")),
    before,
  });
  if (!result) return jsonError("Student not found.", 404);
  return Response.json(result);
}
