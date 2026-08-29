import { normalizeKenyaPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { jsonError, readJson, readString } from "@/server/http";
import { ensureTutor, toTutorProfile } from "@/server/services/tutors";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const token = readString(body, "token");
  const phoneRaw = readString(body, "phone");
  const phone = phoneRaw ? normalizeKenyaPhone(phoneRaw) : null;

  if (!phone || !token) {
    return jsonError("phone and token are required.", 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error || !data.user) {
    return jsonError(error?.message ?? "Invalid or expired code.", 400);
  }

  const tutor = await ensureTutor(data.user);
  if (!tutor) {
    return jsonError("Complete signup with your name and phone first.", 409);
  }

  return Response.json({ ok: true, tutor: toTutorProfile(tutor) });
}
