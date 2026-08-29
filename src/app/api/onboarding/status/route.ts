import { requireTutor } from "@/server/require-tutor";
import { getOnboardingStatus } from "@/server/services/onboarding";

export async function GET() {
  const auth = await requireTutor();
  if (auth.response) return auth.response;
  return Response.json(await getOnboardingStatus(auth.tutor));
}
