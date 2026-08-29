import { createClient } from "@/lib/supabase/server";
import { jsonError, readJson, readString } from "@/server/http";
import { ensureTutor } from "@/server/services/tutors";

/** PKCE `code` exchange. Cookies (code verifier) stay on the server. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const code = readString(body, "code");
  if (!code) return jsonError("missing_code", 400);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return jsonError(error.message, 400);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await ensureTutor(user);

  return Response.json({ ok: true });
}
