import "server-only";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureTutor } from "@/server/services/tutors";

export type AuthChannel = "email" | "sms" | "password";

export const MIN_PASSWORD_LENGTH = 8;

function mapAuthError(message: string | undefined): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("over_email_send_rate_limit")) {
    return "Supabase's built-in email is capped at about 2 messages per hour. Wait an hour, use email and password, or add custom SMTP.";
  }
  if (lower.includes("already been registered") || lower.includes("already registered")) {
    return "That email already has an account. Sign in with password, or use a magic link.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Invalid email or password.";
  }
  return message;
}

export async function requestTutorOtp(options: {
  email?: string;
  phone?: string;
  createUser: boolean;
  metadata?: { display_name?: string; phone?: string };
  redirectOrigin?: string;
}): Promise<{ channel: AuthChannel; error: string | null }> {
  const supabase = await createClient();
  const origin = options.redirectOrigin ?? env.APP_URL;

  if (options.email) {
    const { error } = await supabase.auth.signInWithOtp({
      email: options.email,
      options: {
        shouldCreateUser: options.createUser,
        emailRedirectTo: `${origin}/auth/callback`,
        data: options.metadata,
      },
    });
    return { channel: "email", error: mapAuthError(error?.message) };
  }

  if (!options.phone) {
    return { channel: "email", error: "Email or phone is required." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: options.phone,
    options: {
      shouldCreateUser: options.createUser,
      data: options.metadata,
    },
  });
  return { channel: "sms", error: mapAuthError(error?.message) };
}

export async function signInWithPasswordAccount(email: string, password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return {
      error: mapAuthError(error?.message) ?? "Invalid email or password.",
    };
  }

  const tutor = await ensureTutor(data.user);
  if (!tutor) {
    return {
      error: "Complete signup with your name and phone first.",
    };
  }

  return { error: null };
}

export async function signUpWithPasswordAccount(input: {
  email: string;
  password: string;
  displayName: string;
  phone: string;
}) {
  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      display_name: input.displayName,
      phone: input.phone,
    },
  });

  if (createError) {
    return { error: mapAuthError(createError.message) ?? createError.message };
  }

  return signInWithPasswordAccount(input.email, input.password);
}
