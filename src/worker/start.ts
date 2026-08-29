import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { createDb } from "@/lib/db/client";
import { runPaymentReminder } from "@/lib/jobs/payment-reminder";
import { runPracticeNudge } from "@/lib/jobs/practice-nudge";
import { runWeeklyReport } from "@/lib/jobs/weekly-report";
import { workerEnv } from "@/worker/config";
import {
  JOB_DISPATCH,
  QUEUE_DAILY_PRACTICE,
  QUEUE_PAYMENT_REMINDER,
  QUEUE_WEEKLY_REPORT,
  parseOnceJob,
} from "@/worker/queues";

export async function startWorker(argv: string[]) {
  const env = workerEnv();
  const { client, db } = createDb(env.DATABASE_URL, 2);
  const onceJob = parseOnceJob(argv);

  if (onceJob) {
    const result = await runNamedJob(db, onceJob);
    console.log(`[kusoma] ${onceJob}`, result);
    await client.end({ timeout: 5 });
    return;
  }

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const practiceQueue = new Queue(QUEUE_DAILY_PRACTICE, { connection });
  const reportQueue = new Queue(QUEUE_WEEKLY_REPORT, { connection });
  const paymentQueue = new Queue(QUEUE_PAYMENT_REMINDER, { connection });

  await practiceQueue.upsertJobScheduler(
    JOB_DISPATCH,
    { pattern: "*/15 * * * *" },
    { name: JOB_DISPATCH },
  );
  await reportQueue.upsertJobScheduler(
    JOB_DISPATCH,
    { pattern: "0 7 * * 0" },
    { name: JOB_DISPATCH },
  );
  await paymentQueue.upsertJobScheduler(
    JOB_DISPATCH,
    { pattern: "0 7 1 * *" },
    { name: JOB_DISPATCH },
  );

  const practiceWorker = new Worker(
    QUEUE_DAILY_PRACTICE,
    async () => runPracticeNudge(db),
    { connection },
  );
  const reportWorker = new Worker(
    QUEUE_WEEKLY_REPORT,
    async () => runWeeklyReport(db),
    { connection },
  );
  const paymentWorker = new Worker(
    QUEUE_PAYMENT_REMINDER,
    async () => runPaymentReminder(db),
    { connection },
  );

  practiceWorker.on("completed", (job) => {
    console.log("[kusoma] practice_nudge done", job.id);
  });
  reportWorker.on("completed", (job) => {
    console.log("[kusoma] weekly_report done", job.id);
  });
  paymentWorker.on("completed", (job) => {
    console.log("[kusoma] payment_reminder done", job.id);
  });
  practiceWorker.on("failed", (job, error) => {
    console.error("[kusoma] practice_nudge failed", job?.id, error);
  });
  reportWorker.on("failed", (job, error) => {
    console.error("[kusoma] weekly_report failed", job?.id, error);
  });
  paymentWorker.on("failed", (job, error) => {
    console.error("[kusoma] payment_reminder failed", job?.id, error);
  });

  console.log(
    "[kusoma] Worker up. Queues: daily-practice, weekly-report, payment-reminder. Crons UTC: */15 * * * *, 0 7 * * 0, 0 7 1 * *",
  );

  const shutdown = async () => {
    await Promise.all([
      practiceWorker.close(),
      reportWorker.close(),
      paymentWorker.close(),
      practiceQueue.close(),
      reportQueue.close(),
      paymentQueue.close(),
    ]);
    await connection.quit();
    await client.end({ timeout: 5 });
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

async function runNamedJob(
  db: ReturnType<typeof createDb>["db"],
  name: NonNullable<ReturnType<typeof parseOnceJob>>,
) {
  if (name === "weekly_report") {
    return runWeeklyReport(db);
  }
  if (name === "payment_reminder") {
    return runPaymentReminder(db);
  }
  return runPracticeNudge(db);
}
