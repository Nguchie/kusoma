import { getUser } from "@/lib/supabase/server";
import { normalizeKenyaPhone } from "@/lib/phone";
import { jsonError, readJson, readString } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { ensureTutor, toTutorProfile, updateTutor } from "@/server/services/tutors";

export async function GET() {
  const user = await getUser();
  if (!user) return jsonError("unauthorized", 401);

  const tutor = await ensureTutor(user);
  if (!tutor) {
    return jsonError("Complete signup with your name and phone first.", 409);
  }

  return Response.json(toTutorProfile(tutor));
}

export async function PATCH(request: Request) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const displayName = readString(body, "display_name");
  const phoneRaw = readString(body, "phone");

  let phone: string | undefined;
  if (phoneRaw !== undefined) {
    const normalized = normalizeKenyaPhone(phoneRaw);
    if (!normalized) {
      return jsonError("Enter a valid Kenyan phone number.", 400);
    }
    phone = normalized;
  }

  if (displayName === undefined && phone === undefined) {
    return jsonError("display_name or phone is required.", 400);
  }

  const updated = await updateTutor(auth.tutor.id, {
    displayName,
    phone,
  });
  if (!updated) return jsonError("Could not update profile.", 500);
  return Response.json(updated);
}

