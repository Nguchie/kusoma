import Link from "next/link";

import { requireTutorPage } from "@/server/require-tutor-page";
import { listReportsForTutor } from "@/server/services/reports";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string }>;
}) {
  const tutor = await requireTutorPage();
  const { student_id: studentId } = await searchParams;
  const reports = await listReportsForTutor(tutor.id, studentId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-500">
          Weekly parent drafts. Approve, then mark sent. Delivery is a chat note
          — no WhatsApp.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No reports yet. They appear after the Sunday job, or run{" "}
          <code className="text-xs">npm run worker:once -- weekly_report</code>.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/reports/${report.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">{report.student_name}</p>
                  <p className="text-sm text-zinc-500">
                    {report.period_start} → {report.period_end}
                  </p>
                </div>
                <span className="text-xs text-zinc-500 capitalize">
                  {report.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
