import Link from "next/link";

import { DashboardCards } from "@/components/tutor/dashboard-cards";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";
import { requireTutorPage } from "@/server/require-tutor-page";
import { getDashboardSummary } from "@/server/services/dashboard";

export default async function DashboardPage() {
  const tutor = await requireTutorPage();
  const summary = await getDashboardSummary(tutor.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-sm text-zinc-500">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tutor.displayName}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{tutor.phone}</p>
      </div>

      <DashboardCards summary={summary} />

      <div className="flex flex-wrap gap-2">
        <Link href="/students" className={primaryButtonClass}>
          Students
        </Link>
        <Link href="/reports" className={secondaryButtonClass}>
          Reports
        </Link>
        <Link href="/payments" className={secondaryButtonClass}>
          Payments
        </Link>
      </div>
    </main>
  );
}
