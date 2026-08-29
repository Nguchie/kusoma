import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/tutor/logout-button";
import { requireOnboardedTutorPage } from "@/server/require-tutor-page";

export default async function TutorLayout({ children }: { children: ReactNode }) {
  const tutor = await requireOnboardedTutorPage();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Kusoma
          </Link>
          <Link href="/students" className="text-zinc-600 dark:text-zinc-400">
            Students
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-500 sm:inline">
            {tutor.displayName}
          </span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
