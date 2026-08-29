/** Normalize Kenyan mobile numbers to E.164 (`+254…`). Tutors, students, and chat identify. */
export function normalizeKenyaPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-().]/g, "");
  if (!compact) return null;

  let digits = compact.startsWith("+") ? compact.slice(1) : compact;
  digits = digits.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 10) {
    digits = `254${digits.slice(1)}`;
  } else if (
    (digits.startsWith("7") || digits.startsWith("1")) &&
    digits.length === 9
  ) {
    digits = `254${digits}`;
  }

  if (!/^254[17]\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

export function isEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
