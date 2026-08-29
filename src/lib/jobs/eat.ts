export function nairobiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function nairobiHourMinute(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  return { hour, minute };
}

export function nairobiMonthStart(now = new Date()): string {
  const key = nairobiDateKey(now);
  return `${key.slice(0, 7)}-01`;
}

export function addNairobiDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T12:00:00+03:00`) + days * 86_400_000;
  return nairobiDateKey(new Date(ms));
}

export function parseNudgeHm(value: string | null | undefined): {
  hour: number;
  minute: number;
} {
  const raw = (value ?? "15:00").slice(0, 5);
  const [hourRaw, minuteRaw] = raw.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return {
    hour: Number.isInteger(hour) ? hour : 15,
    minute: Number.isInteger(minute) ? minute : 0,
  };
}

/** True when Nairobi local time is in [nudge, nudge + windowMinutes). */
export function isInNudgeWindow(
  nudgeTime: string | null | undefined,
  now = new Date(),
  windowMinutes = 15,
): boolean {
  const nudge = parseNudgeHm(nudgeTime);
  const current = nairobiHourMinute(now);
  const nudgeMins = nudge.hour * 60 + nudge.minute;
  const nowMins = current.hour * 60 + current.minute;
  const delta = nowMins - nudgeMins;
  return delta >= 0 && delta < windowMinutes;
}
