import { isEmail, normalizeKenyaPhone } from "@/lib/phone";
import { jsonError, readJson, readString } from "@/server/http";
import {
  MIN_PASSWORD_LENGTH,
  requestTutorOtp,
  signInWithPasswordAccount,
} from "@/server/services/auth";

function readPassword(body: Record<string, unknown>): string | undefined {
  const value = body.password;
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const emailRaw = readString(body, "email");
  const phoneRaw = readString(body, "phone");
  const password = readPassword(body);

  if (password) {
    const email = emailRaw?.toLowerCase();
    if (!email || !isEmail(email)) {
      return jsonError("Enter a valid email address.", 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        400,
      );
    }
    const { error } = await signInWithPasswordAccount(email, password);
    if (error) return jsonError(error, 401);
    return Response.json({ ok: true, channel: "password" });
  }

  if (emailRaw && phoneRaw) {
    return jsonError("Send either email or phone, not both.", 400);
  }

  const email = emailRaw?.toLowerCase();
  if (email && !isEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  const phone = phoneRaw ? normalizeKenyaPhone(phoneRaw) : null;
  if (phoneRaw && !phone) {
    return jsonError("Enter a valid Kenyan phone number.", 400);
  }

  if (!email && !phone) {
    return jsonError("Email or phone is required.", 400);
  }

  const { channel, error } = await requestTutorOtp({
    email,
    phone: phone ?? undefined,
    createUser: false,
    redirectOrigin: new URL(request.url).origin,
  });

  if (error) return jsonError(error, 400);

  return Response.json({ ok: true, channel });
}
