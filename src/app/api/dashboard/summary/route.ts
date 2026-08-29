import { getDashboardSummary } from "@/server/services/dashboard";
import { requireTutor } from "@/server/require-tutor";

export async function GET() {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const summary = await getDashboardSummary(auth.tutor.id);
  return Response.json(summary);
}
