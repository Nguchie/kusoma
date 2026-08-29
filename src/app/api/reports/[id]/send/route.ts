import { isUuid, jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { sendReportForTutor } from "@/server/services/reports";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid report id.", 400);

  const result = await sendReportForTutor(auth.tutor.id, id);
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.report);
}
