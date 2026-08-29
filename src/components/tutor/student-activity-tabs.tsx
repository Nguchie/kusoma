"use client";

import { useState } from "react";

type StudentProblemJson = {
  id: string;
  mode: string;
  problem_text: string;
  student_answer: string | null;
  is_correct: boolean | null;
  error_type: string | null;
  error_detail: string | null;
  ai_explanation: string | null;
  content_source: string;
  created_at: string;
  attempted_at: string | null;
};

type StudentActivityTabsProps = {
  homework: StudentProblemJson[];
  practice: StudentProblemJson[];
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultLabel(item: StudentProblemJson): string {
  if (item.is_correct === true) return "Correct";
  if (item.is_correct === false) return "Incorrect";
  if (item.student_answer) return "Answered";
  return "Not answered";
}

function ProblemList({
  items,
  empty,
}: {
  items: StudentProblemJson[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          <p className="whitespace-pre-wrap">{item.problem_text}</p>
          <p className="mt-2 text-xs text-zinc-500">
            {resultLabel(item)}
            {item.attempted_at || item.created_at
              ? ` · ${formatWhen(item.attempted_at ?? item.created_at)}`
              : ""}
          </p>
          {item.student_answer ? (
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              Attempt: {item.student_answer}
            </p>
          ) : null}
          {item.error_detail ? (
            <p className="mt-1 text-xs text-zinc-500">{item.error_detail}</p>
          ) : null}
          {item.ai_explanation ? (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {item.ai_explanation}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function StudentActivityTabs({
  homework,
  practice,
}: StudentActivityTabsProps) {
  const [tab, setTab] = useState<"homework" | "practice">("homework");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${
            tab === "homework"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
          onClick={() => setTab("homework")}
        >
          Homework Activity
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${
            tab === "practice"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
          onClick={() => setTab("practice")}
        >
          Practice Sessions
        </button>
      </div>
      {tab === "homework" ? (
        <ProblemList
          items={homework}
          empty="No homework activity yet."
        />
      ) : (
        <ProblemList
          items={practice}
          empty="No practice sessions yet."
        />
      )}
    </div>
  );
}
