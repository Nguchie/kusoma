import Link from "next/link";

import type { DashboardSummary } from "@/server/services/dashboard";

type Card = {
  label: string;
  value: number;
  hint: string;
  href?: string;
};

export function DashboardCards({ summary }: { summary: DashboardSummary }) {
  const cards: Card[] = [
    {
      label: "Active students",
      value: summary.active_students,
      hint: "On your roster",
      href: "/students",
    },
    {
      label: "Engagement today",
      value: summary.engagement_today,
      hint: "Students who messaged today",
    },
    {
      label: "Pending reports",
      value: summary.pending_reports,
      hint: "Drafts waiting for review",
      href: "/reports",
    },
    {
      label: "Overdue payments",
      value: summary.overdue_payments,
      hint: "Pending this month",
      href: "/payments",
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map((card) => {
        const inner = (
          <>
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{card.hint}</p>
          </>
        );

        return (
          <li key={card.label}>
            {card.href ? (
              <Link
                href={card.href}
                className="block rounded-md border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {inner}
              </Link>
            ) : (
              <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
