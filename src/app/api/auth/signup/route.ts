import { isEmail, normalizeKenyaPhone } from "@/lib/phone";
import { jsonError, readJson, readString } from "@/server/http";
import {
  MIN_PASSWORD_LENGTH,
  requestTutorOtp,
  signUpWithPasswordAccount,
} from "@/server/services/auth";

function readPassword(body: Record<string, unknown>): string | undefined {
  const value = body.password;
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const displayName = readString(body, "display_name");
  const emailRaw = readString(body, "email");
  const phoneRaw = readString(body, "phone");
  const password = readPassword(body);

  if (!displayName || displayName.length < 2) {
    return jsonError("display_name is required.", 400);
  }

  const phone = phoneRaw ? normalizeKenyaPhone(phoneRaw) : null;
  if (!phone) {
    return jsonError("A valid Kenyan phone number is required.", 400);
  }

  const email = emailRaw?.toLowerCase();
  if (email && !isEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  if (password) {
    if (!email) return jsonError("Email is required for password signup.", 400);
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        400,
      );
    }
    const { error } = await signUpWithPasswordAccount({
      email,
      password,
      displayName,
      phone,
    });
    if (error) return jsonError(error, 400);
    return Response.json({ ok: true, channel: "password" }, { status: 201 });
  }

  const { channel, error } = await requestTutorOtp({
    email,
    phone: email ? undefined : phone,
    createUser: true,
    metadata: { display_name: displayName, phone },
    redirectOrigin: new URL(request.url).origin,
  });

  if (error) return jsonError(error, 400);

  return Response.json({ ok: true, channel });
}
