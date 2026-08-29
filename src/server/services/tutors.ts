import "server-only";

import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { tutors } from "@/lib/db/schema";
import { normalizeKenyaPhone } from "@/lib/phone";

export type TutorProfile = {
  id: string;
  user_id: string;
  display_name: string;
  phone: string;
  onboarding_completed_at: string | null;
};

export function toTutorProfile(
  row: typeof tutors.$inferSelect,
): TutorProfile {
  return {
    id: row.id,
    user_id: row.userId,
    display_name: row.displayName,
    phone: row.phone,
    onboarding_completed_at: row.onboardingCompletedAt?.toISOString() ?? null,
  };
}

export async function getTutorByUserId(userId: string) {
  const [row] = await db
    .select()
    .from(tutors)
    .where(eq(tutors.userId, userId))
    .limit(1);
  return row ?? null;
}

function metadataString(user: User, key: string): string | undefined {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function displayNameFromUser(user: User): string | null {
  const fromMeta =
    metadataString(user, "display_name") ?? metadataString(user, "displayName");
  if (fromMeta) return fromMeta;
  const emailName = user.email?.split("@")[0];
  return emailName && emailName.length > 0 ? emailName : null;
}

function phoneFromUser(user: User): string | null {
  const raw = user.phone || metadataString(user, "phone");
  return raw ? normalizeKenyaPhone(raw) : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export async function updateTutor(
  tutorId: string,
  input: { displayName?: string; phone?: string },
) {
  const patch: Partial<typeof tutors.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.phone !== undefined) patch.phone = input.phone;

  const [updated] = await db
    .update(tutors)
    .set(patch)
    .where(eq(tutors.id, tutorId))
    .returning();

  return updated ? toTutorProfile(updated) : null;
}

/** Insert a tutors row after the Auth user exists (signup / first login). */
export async function ensureTutor(user: User) {
  const existing = await getTutorByUserId(user.id);
  if (existing) return existing;

  const displayName = displayNameFromUser(user);
  const phone = phoneFromUser(user);
  if (!displayName || !phone) return null;

  try {
    const [created] = await db
      .insert(tutors)
      .values({
        userId: user.id,
        displayName,
        phone,
      })
      .returning();
    return created ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return getTutorByUserId(user.id);
    }
    throw error;
  }
}
