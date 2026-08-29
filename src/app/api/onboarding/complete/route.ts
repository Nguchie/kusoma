import { jsonError } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { completeOnboarding, getOnboardingStatus } from "@/server/services/onboarding";
import { toTutorProfile } from "@/server/services/tutors";

export async function POST() {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const result = await completeOnboarding(auth.tutor.id);
  if (!result.ok) return jsonError(result.error, 400);

  return Response.json({
    ...toTutorProfile(result.tutor),
    ...(await getOnboardingStatus(result.tutor)),
  });
}
