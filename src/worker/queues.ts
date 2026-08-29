export const QUEUE_DAILY_PRACTICE = "daily-practice";
export const QUEUE_WEEKLY_REPORT = "weekly-report";
export const QUEUE_PAYMENT_REMINDER = "payment-reminder";

export const JOB_DISPATCH = "dispatch";

export type OnceJobName =
  | "practice_nudge"
  | "weekly_report"
  | "payment_reminder";

export function parseOnceJob(argv: string[]): OnceJobName | null {
  if (!argv.includes("--once")) return null;
  for (const arg of argv) {
    if (
      arg === "practice_nudge" ||
      arg === "weekly_report" ||
      arg === "payment_reminder"
    ) {
      return arg;
    }
  }
  return "practice_nudge";
}
