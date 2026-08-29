import { jsonError } from "@/server/http";
import { parseGrade } from "@/server/services/students";
import { requireTutor } from "@/server/require-tutor";
import { loadCurriculumTree } from "@/server/services/curriculum";

export async function GET(request: Request) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const grade = parseGrade(Number(url.searchParams.get("grade")));
  const subject = (url.searchParams.get("subject") ?? "mathematics").trim();

  if (grade === null) {
    return jsonError("grade must be an integer from 1 to 9.", 400);
  }
  if (!subject) return jsonError("subject is required.", 400);

  const result = await loadCurriculumTree(grade, subject.toLowerCase());
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.tree);
}
