import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const HOMEWORK_IMAGES_BUCKET = "homework-images";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function extensionFor(file: File): string | null {
  const fromType = ALLOWED_TYPES[file.type.toLowerCase()];
  if (fromType) return fromType;

  const name = file.name.toLowerCase();
  const match = name.match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  const ext = match[1];
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png" || ext === "webp" || ext === "heic" || ext === "heif") {
    return ext;
  }
  return null;
}

export function isHomeworkImagePath(value: string): boolean {
  return !/^https?:\/\//i.test(value);
}

export async function uploadHomeworkImage(
  studentId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "Image file is empty." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 8MB or smaller." };
  }

  const ext = extensionFor(file);
  if (!ext) {
    return {
      ok: false,
      error: "Use a JPEG, PNG, WebP, or HEIC image.",
    };
  }

  const path = `${studentId}/${randomUUID()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(HOMEWORK_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });

  if (error) {
    console.error("[kusoma] homework-images upload failed:", error.message);
    return { ok: false, error: "Could not store the image." };
  }

  return { ok: true, path };
}

export async function signedHomeworkImageUrl(
  path: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(HOMEWORK_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
