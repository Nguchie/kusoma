import { getCurriculumTree } from "@/lib/cbc";
import { env } from "@/lib/env";
import { jsonError } from "@/server/http";

/** Dev-only: Grade 5 Mathematics tree, 5s timeout (Guide Step 1.14). */
export async function GET() {
  if (env.NODE_ENV === "production") {
    return jsonError("Not found.", 404);
  }

  const result = await getCurriculumTree("mathematics", 5);
  if (!result.ok) {
    const status =
      result.error.kind === "not_configured"
        ? 503
        : result.error.kind === "timeout"
          ? 504
          : 502;
    return Response.json({ ok: false, error: result.error }, { status });
  }

  return Response.json({ ok: true, data: result.data });
}
