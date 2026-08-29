import "server-only";

import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/server";
import { ensureTutor } from "@/server/services/tutors";

export async function requireTutorPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const tutor = await ensureTutor(user);
  if (!tutor) redirect("/signup");
  return tutor;
}

export async function requireOnboardedTutorPage() {
  const tutor = await requireTutorPage();
  if (!tutor.onboardingCompletedAt) redirect("/onboarding");
  return tutor;
}
