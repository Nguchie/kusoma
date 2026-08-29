"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CurriculumBrowser } from "@/components/tutor/curriculum-browser";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

export type AssignmentItem = {
  id: string;
  student_id: string;
  cbc_node_id: string;
  strand: string;
  sub_strand: string;
  learning_outcome: string;
  difficulty: string;
  status: string;
  tutor_notes: string | null;
  assigned_at: string | null;
  completed_at: string | null;
};

type AssignmentPanelProps = {
  studentId: string;
  studentName: string;
  grade: number;
  assignments: AssignmentItem[];
};

function formatAssignedAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "completed") return "Completed";
  return status;
}

export function AssignmentPanel({
  studentId,
  studentName,
  grade,
  assignments: initialAssignments,
}: AssignmentPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialAssignments);
  const [browsing, setBrowsing] = useState(
    () => !initialAssignments.some((item) => item.status === "active"),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actives = items.filter((item) => item.status === "active");
  const history = items.filter((item) => item.status !== "active");

  async function reload() {
    const response = await fetch(`/api/students/${studentId}/assignments`);
    const data = (await response.json()) as {
      assignments?: AssignmentItem[];
      error?: string;
    };
    if (response.ok && Array.isArray(data.assignments)) {
      setItems(data.assignments);
    }
    router.refresh();
  }

  async function patch(assignmentId: string, body: Record<string, string>) {
    setError(null);
    setPendingId(assignmentId);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update that assignment.");
        return;
      }
      await reload();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section id="assign" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Practice topics</h2>
        <p className="text-sm text-zinc-500">
          Grade {grade} Mathematics. A student can have more than one active
          topic. Chat practice uses the most recently saved one.
        </p>
      </div>

      {actives.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {actives.map((active) => (
            <li
              key={active.id}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {statusLabel(active.status)}
              </p>
              <p className="mt-1 font-medium">{active.learning_outcome}</p>
              <p className="text-sm text-zinc-500">
                {active.strand} → {active.sub_strand}
              </p>
              {active.assigned_at ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Assigned {formatAssignedAt(active.assigned_at)}
                </p>
              ) : null}

              <label className="mt-3 flex max-w-xs flex-col gap-1 text-sm">
                Difficulty
                <select
                  className={inputClass}
                  value={active.difficulty}
                  disabled={pendingId === active.id}
                  onChange={(event) => {
                    void patch(active.id, { difficulty: event.target.value });
                  }}
                >
                  <option value="foundational">Foundational</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={pendingId === active.id}
                  onClick={() => void patch(active.id, { status: "paused" })}
                >
                  Pause
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={pendingId === active.id}
                  onClick={() => void patch(active.id, { status: "completed" })}
                >
                  Mark complete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          No active topics. Pick one or more learning outcomes for {studentName}.
        </p>
      )}

      <div>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => setBrowsing((open) => !open)}
        >
          {browsing ? "Hide picker" : "Add topics"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {browsing ? (
        <CurriculumBrowser
          key={grade}
          grade={grade}
          studentId={studentId}
          onCancel={() => setBrowsing(false)}
          onAssigned={() => {
            setBrowsing(false);
            void reload();
          }}
        />
      ) : null}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-zinc-500">Earlier topics</h3>
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{item.learning_outcome}</p>
                  <p className="text-xs text-zinc-500">
                    {item.strand} → {item.sub_strand} · {statusLabel(item.status)}{" "}
                    · {item.difficulty}
                  </p>
                </div>
                {item.status === "paused" ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={pendingId === item.id}
                    onClick={() => void patch(item.id, { status: "active" })}
                  >
                    Make active
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
