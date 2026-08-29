"use client";

import { useEffect, useState } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";
import type {
  CurriculumStrand,
  CurriculumTree,
} from "@/lib/cbc/tree";

type CurriculumBrowserProps = {
  grade: number;
  studentId: string;
  onAssigned: () => void;
  subject?: string;
  assignLabel?: string;
};

function treeUrl(grade: number, subject: string) {
  return `/api/curriculum/${grade}/${encodeURIComponent(subject)}`;
}

export function CurriculumBrowser({
  grade,
  studentId,
  onAssigned,
  subject = "mathematics",
  assignLabel = "Assign topic",
}: CurriculumBrowserProps) {
  const [tree, setTree] = useState<CurriculumTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStrand, setOpenStrand] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
    strand: string;
    subStrand: string;
  } | null>(null);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [pending, setPending] = useState(false);

  async function loadTree() {
    try {
      const response = await fetch(treeUrl(grade, subject));
      const data = (await response.json()) as CurriculumTree & {
        error?: string;
      };
      if (!response.ok) {
        setTree(null);
        setError(
          data.error ??
            "Curriculum data is temporarily unavailable — try again in a moment",
        );
        return;
      }
      setError(null);
      setTree(data);
    } catch {
      setTree(null);
      setError(
        "Curriculum data is temporarily unavailable — try again in a moment",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(treeUrl(grade, subject))
      .then(async (response) => {
        const data = (await response.json()) as CurriculumTree & {
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setTree(null);
          setError(
            data.error ??
              "Curriculum data is temporarily unavailable — try again in a moment",
          );
          return;
        }
        setError(null);
        setTree(data);
      })
      .catch(() => {
        if (cancelled) return;
        setTree(null);
        setError(
          "Curriculum data is temporarily unavailable — try again in a moment",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grade, subject]);

  async function assign() {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${studentId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cbc_node_id: selected.id,
          difficulty,
          strand: selected.strand,
          sub_strand: selected.subStrand,
          learning_outcome: selected.title,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not assign that topic.");
        return;
      }
      setSelected(null);
      onAssigned();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  function strandKey(strand: CurriculumStrand, index: number) {
    return strand.id ?? `strand-${index}`;
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading curriculum…</p>;
  }

  if (error && !tree) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setLoading(true);
            setError(null);
            void loadTree();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!tree || tree.strands.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No Mathematics topics came back for Grade {grade}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Grade {grade} {subject.charAt(0).toUpperCase() + subject.slice(1)}. Pick
        a learning outcome.
      </p>
      <ul className="flex flex-col gap-2">
        {tree.strands.map((strand, strandIndex) => {
          const key = strandKey(strand, strandIndex);
          const open = openStrand === key;
          return (
            <li
              key={key}
              className="rounded-md border border-zinc-200 dark:border-zinc-800"
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-medium"
                onClick={() => {
                  setOpenStrand(open ? null : key);
                  setOpenSub(null);
                }}
              >
                {strand.title}
              </button>
              {open ? (
                <ul className="border-t border-zinc-200 dark:border-zinc-800">
                  {strand.subStrands.map((sub, subIndex) => {
                    const subKey = sub.id ?? `${key}-sub-${subIndex}`;
                    const subOpen = openSub === subKey;
                    return (
                      <li key={subKey}>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300"
                          onClick={() => setOpenSub(subOpen ? null : subKey)}
                        >
                          {sub.title}
                        </button>
                        {subOpen ? (
                          <ul className="bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
                            {sub.outcomes.map((outcome) => {
                              const isSelected = selected?.id === outcome.id;
                              return (
                                <li key={outcome.id}>
                                  <button
                                    type="button"
                                    className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                                      isSelected
                                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                        : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    }`}
                                    onClick={() =>
                                      setSelected({
                                        id: outcome.id,
                                        title: outcome.title,
                                        strand: strand.title,
                                        subStrand: sub.title,
                                      })
                                    }
                                  >
                                    {outcome.title}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm">
            <span className="font-medium">{selected.title}</span>
            <span className="block text-zinc-500">
              {selected.strand} → {selected.subStrand}
            </span>
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Difficulty
            <select
              className={inputClass}
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="foundational">Foundational</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className={primaryButtonClass}
            disabled={pending}
            onClick={() => void assign()}
          >
            {pending ? "Assigning…" : assignLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
