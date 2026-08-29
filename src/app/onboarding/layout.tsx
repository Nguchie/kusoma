import { LogoutButton } from "@/components/tutor/logout-button";
import { requireTutorPage } from "@/server/require-tutor-page";
import type { ReactNode } from "react";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const tutor = await requireTutorPage();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <p className="font-semibold tracking-tight">Kusoma</p>
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
