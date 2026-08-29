import "server-only";

import { jsonError } from "@/server/http";
import { getUser } from "@/lib/supabase/server";
import { tutors } from "@/lib/db/schema";
import { getTutorByUserId } from "@/server/services/tutors";

export type TutorRow = typeof tutors.$inferSelect;

export async function requireTutor(): Promise<
  { tutor: TutorRow; response?: never } | { tutor?: never; response: Response }
> {
  const user = await getUser();
  if (!user) {
    return { response: jsonError("unauthorized", 401) };
  }

  const tutor = await getTutorByUserId(user.id);
  if (!tutor) {
    return { response: jsonError("Complete signup with your name and phone first.", 409) };
  }

  return { tutor };
}
