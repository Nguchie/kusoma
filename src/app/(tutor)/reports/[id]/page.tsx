import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportEditor } from "@/components/tutor/report-editor";
import { isUuid } from "@/server/http";
import { requireTutorPage } from "@/server/require-tutor-page";
import { getReportForTutor } from "@/server/services/reports";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tutor = await requireTutorPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const report = await getReportForTutor(tutor.id, id);
  if (!report) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/reports" className="text-sm text-zinc-500 underline">
          Back to reports
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {report.student_name}
        </h1>
        <p className="text-sm text-zinc-500">
          Grade {report.grade} · {report.period_start} → {report.period_end} ·{" "}
          {report.status}
        </p>
      </div>
      <ReportEditor
        reportId={report.id}
        initialBody={report.report_body}
        initialStatus={report.status}
      />
    </main>
  );
}
