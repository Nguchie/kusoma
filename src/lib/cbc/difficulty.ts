import type { AssignmentDifficulty } from "@/lib/cbc/types";

/** §6.3 — maps Kusoma assignment difficulty to CBC `cognitive_level`. */
export function cognitiveLevelsForDifficulty(
  difficulty: AssignmentDifficulty,
): string {
  switch (difficulty) {
    case "foundational":
      return "recall,application";
    case "intermediate":
      return "application,analysis";
    case "advanced":
      return "analysis,evaluation,creation";
  }
}
