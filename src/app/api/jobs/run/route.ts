import { jsonError, readJson, readString } from "@/server/http";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { runPaymentReminder } from "@/lib/jobs/payment-reminder";
import { runPracticeNudge } from "@/lib/jobs/practice-nudge";
import { runWeeklyReport } from "@/lib/jobs/weekly-report";
import { requireTutor } from "@/server/require-tutor";

export async function POST(request: Request) {
  if (env.NODE_ENV === "production") {
    return jsonError("Not found.", 404);
  }

  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const job = readString(body, "job");
  if (job === "practice_nudge") {
    return Response.json({ job, result: await runPracticeNudge(db) });
  }
  if (job === "weekly_report") {
    return Response.json({
      job,
      result: await runWeeklyReport(db, {
        anthropicApiKey: env.ANTHROPIC_API_KEY,
      }),
    });
  }
  if (job === "payment_reminder") {
    return Response.json({ job, result: await runPaymentReminder(db) });
  }

  return jsonError(
    "job must be practice_nudge, weekly_report, or payment_reminder.",
    400,
  );
}
