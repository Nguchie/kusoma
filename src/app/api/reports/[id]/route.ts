import { isUuid, jsonError, readJson, readString } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  getReportForTutor,
  updateReportForTutor,
} from "@/server/services/reports";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid report id.", 400);

  const report = await getReportForTutor(auth.tutor.id, id);
  if (!report) return jsonError("Report not found.", 404);
  return Response.json(report);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid report id.", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  let status: "approved" | undefined;
  if ("status" in body) {
    const raw = readString(body, "status");
    if (raw !== "approved") {
      return jsonError("status must be approved.", 400);
    }
    status = "approved";
  }

  const result = await updateReportForTutor({
    tutorId: auth.tutor.id,
    reportId: id,
    reportBody: readString(body, "report_body"),
    status,
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.report);
}
