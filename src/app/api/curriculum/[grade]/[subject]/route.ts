import { jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { parseGrade } from "@/server/services/students";
import { loadCurriculumTree } from "@/server/services/curriculum";

type RouteContext = { params: Promise<{ grade: string; subject: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { grade: gradeRaw, subject: subjectRaw } = await context.params;
  const grade = parseGrade(Number(gradeRaw));
  const subject = decodeURIComponent(subjectRaw).trim().toLowerCase();

  if (grade === null) {
    return jsonError("grade must be an integer from 1 to 9.", 400);
  }
  if (!subject) return jsonError("subject is required.", 400);

  const result = await loadCurriculumTree(grade, subject);
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.tree);
}
