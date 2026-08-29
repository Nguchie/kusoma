import type { TopicPerformanceJson } from "@/server/services/student-activity";

const SOURCE_LABEL = {
  homework: "Homework",
  practice: "Practice",
  both: "Both",
} as const;

function formatEngaged(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TopicPerformanceList({
  items,
}: {
  items: TopicPerformanceJson[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No topic activity yet. Accuracy appears here after homework or practice.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {items.map((row) => (
        <li key={row.cbc_node_id} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{row.learning_outcome}</p>
              <p className="text-xs text-zinc-500">
                {row.strand} → {row.sub_strand}
              </p>
            </div>
            <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
              {SOURCE_LABEL[row.source]}
            </span>
          </div>
          <p className="text-sm">
            {row.accuracy === null
              ? "No scored attempts yet"
              : `${row.accuracy}% · ${row.correct_count}/${row.total_problems} correct`}
          </p>
          {row.common_errors.length > 0 ? (
            <ul className="text-xs text-zinc-500">
              {row.common_errors.slice(0, 3).map((error) => (
                <li key={`${error.type}-${error.detail}`}>
                  {error.detail}
                  {error.count > 1 ? ` (${error.count})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-zinc-400">
            Last engaged {formatEngaged(row.last_engaged_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
