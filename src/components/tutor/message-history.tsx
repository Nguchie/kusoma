"use client";

import { useState } from "react";

import { secondaryButtonClass } from "@/components/tutor/styles";

type HistoryMessage = {
  id: string;
  mode: string;
  direction: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

export function MessageHistory({
  studentId,
  studentName,
  initial,
  initialNextBefore,
}: {
  studentId: string;
  studentName: string;
  initial: HistoryMessage[];
  initialNextBefore: string | null;
}) {
  const [items, setItems] = useState(initial);
  const [nextBefore, setNextBefore] = useState(initialNextBefore);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!nextBefore || pending) return;
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        before: nextBefore,
        limit: "50",
      });
      const response = await fetch(
        `/api/students/${studentId}/messages?${params}`,
      );
      const data = (await response.json()) as {
        messages?: HistoryMessage[];
        next_before?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not load more messages.");
        return;
      }
      setItems((current) => [...current, ...(data.messages ?? [])]);
      setNextBefore(data.next_before ?? null);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No messages yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-md border px-3 py-2 text-sm dark:border-zinc-800 ${
              item.direction === "outbound"
                ? "bg-zinc-50 dark:bg-zinc-900"
                : ""
            }`}
          >
            <p className="text-xs text-zinc-500">
              {item.direction === "inbound" ? studentName : "Kusoma"} ·{" "}
              {item.mode === "topic_practice" ? "Practice" : "Homework"} ·{" "}
              {formatWhen(item.created_at)}
            </p>
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt="Homework photo"
                className="mt-2 max-h-64 rounded-md object-contain"
              />
            ) : null}
            {item.body ? (
              <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {nextBefore ? (
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={pending}
          onClick={() => void loadMore()}
        >
          {pending ? "Loading…" : "Load older messages"}
        </button>
      ) : null}
    </div>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
