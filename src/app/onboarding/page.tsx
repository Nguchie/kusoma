import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/tutor/onboarding-flow";
import { env } from "@/lib/env";
import { requireTutorPage } from "@/server/require-tutor-page";
import { getOnboardingStatus } from "@/server/services/onboarding";

export default async function OnboardingPage() {
  const tutor = await requireTutorPage();
  const status = await getOnboardingStatus(tutor);
  if (status.status === "complete") redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
      <OnboardingFlow
        initial={status}
        displayName={tutor.displayName}
        phone={tutor.phone}
        chatUrl={`${env.APP_URL.replace(/\/$/, "")}/chat`}
      />
    </main>
  );
}
