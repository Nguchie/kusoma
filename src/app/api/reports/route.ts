import { isUuid, jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { listReportsForTutor } from "@/server/services/reports";

export async function GET(request: Request) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const studentId = url.searchParams.get("student_id");
  if (studentId && !isUuid(studentId)) {
    return jsonError("Invalid student id.", 400);
  }

  const reports = await listReportsForTutor(
    auth.tutor.id,
    studentId ?? undefined,
  );
  return Response.json({ reports });
}
