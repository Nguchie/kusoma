import "server-only";

import { getCurriculumTree } from "@/lib/cbc/client";
import {
  CURRICULUM_UNAVAILABLE,
  parseCurriculumTree,
  type CurriculumTree,
} from "@/lib/cbc/tree";

export async function loadCurriculumTree(
  grade: number,
  subject: string,
): Promise<
  | { ok: true; tree: CurriculumTree }
  | { ok: false; error: string; status: number }
> {
  const result = await getCurriculumTree(subject, grade);
  if (!result.ok) {
    const status =
      result.error.kind === "not_configured"
        ? 503
        : result.error.kind === "timeout"
          ? 504
          : 502;
    return { ok: false, error: CURRICULUM_UNAVAILABLE, status };
  }

  const tree = parseCurriculumTree(result.data, { grade, subject });
  return { ok: true, tree };
}
