"use client";

import { useEffect, useState } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";
import type {
  CurriculumStrand,
  CurriculumSubStrand,
  CurriculumTree,
} from "@/lib/cbc/tree";

type CurriculumBrowserProps = {
  grade: number;
  studentId: string;
  onAssigned: () => void;
  onCancel?: () => void;
  subject?: string;
};

type SelectedTopic = {
  id: string;
  title: string;
  strand: string;
  subStrand: string;
};

function treeUrl(grade: number, subject: string) {
  return `/api/curriculum/${grade}/${encodeURIComponent(subject)}`;
}

const rowClass =
  "flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-3 text-left text-sm dark:border-zinc-800";

export function CurriculumBrowser({
  grade,
  studentId,
  onAssigned,
  onCancel,
  subject = "mathematics",
}: CurriculumBrowserProps) {
  const [tree, setTree] = useState<CurriculumTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [strand, setStrand] = useState<CurriculumStrand | null>(null);
  const [sub, setSub] = useState<CurriculumSubStrand | null>(null);
  const [queued, setQueued] = useState<SelectedTopic[]>([]);
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

  function goBack() {
    setError(null);
    if (sub) {
      setSub(null);
      return;
    }
    if (strand) {
      setStrand(null);
      return;
    }
    onCancel?.();
  }

  function toggleTopic(topic: SelectedTopic) {
    setQueued((current) => {
      if (current.some((item) => item.id === topic.id)) {
        return current.filter((item) => item.id !== topic.id);
      }
      return [...current, topic];
    });
  }

  function isQueued(id: string) {
    return queued.some((item) => item.id === id);
  }

  function chooseStrand(next: CurriculumStrand) {
    setSub(null);
    setStrand(next);
  }

  function chooseSub(next: CurriculumSubStrand, parent: CurriculumStrand) {
    if (next.outcomes.length > 0) {
      setSub(next);
      return;
    }
    if (next.id) {
      toggleTopic({
        id: next.id,
        title: next.title,
        strand: parent.title,
        subStrand: next.title,
      });
      return;
    }
    setSub(next);
  }

  async function save() {
    if (queued.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${studentId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty,
          topics: queued.map((topic) => ({
            cbc_node_id: topic.id,
            strand: topic.strand,
            sub_strand: topic.subStrand,
            learning_outcome: topic.title,
            difficulty,
          })),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save those topics.");
        return;
      }
      setQueued([]);
      onAssigned();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const canGoBack = Boolean(sub || strand || onCancel);
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);
  const crumb = [
    `Grade ${grade} ${subjectLabel}`,
    strand?.title,
    sub && sub.title !== strand?.title ? sub.title : null,
  ]
    .filter(Boolean)
    .join(" → ");

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
      <div className="flex flex-wrap items-center gap-2">
        {canGoBack ? (
          <button type="button" className={secondaryButtonClass} onClick={goBack}>
            Back
          </button>
        ) : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{crumb}</p>
      </div>

      <p className="text-sm text-zinc-500">
        Add as many topics as you like, then save. Chat practice uses the most
        recently saved topic.
      </p>

      {!strand ? (
        <ul className="flex flex-col gap-2">
          {tree.strands.map((item, index) => (
            <li key={item.id ?? `strand-${index}`}>
              <button
                type="button"
                className={rowClass}
                onClick={() => chooseStrand(item)}
              >
                <span className="font-medium">{item.title}</span>
                <span className="shrink-0 text-zinc-400">Continue</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {strand && !sub ? (
        <ul className="flex flex-col gap-2">
          {strand.subStrands.map((item, index) => (
            <li key={item.id ?? `sub-${index}`}>
              <button
                type="button"
                className={rowClass}
                onClick={() => chooseSub(item, strand)}
              >
                <span>{item.title}</span>
                <span className="shrink-0 text-zinc-400">
                  {item.outcomes.length > 0
                    ? "Continue"
                    : item.id && isQueued(item.id)
                      ? "Added"
                      : "Add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {strand && sub ? (
        <div className="flex flex-col gap-2">
          {sub.outcomes.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-500">
                No learning outcomes under this heading. You can still add the
                heading itself if it has an id.
              </p>
              {sub.id ? (
                <button
                  type="button"
                  className={rowClass}
                  onClick={() =>
                    toggleTopic({
                      id: sub.id as string,
                      title: sub.title,
                      strand: strand.title,
                      subStrand: sub.title,
                    })
                  }
                >
                  <span>{sub.title}</span>
                  <span className="shrink-0 text-zinc-400">
                    {isQueued(sub.id) ? "Added" : "Add"}
                  </span>
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sub.outcomes.map((outcome) => {
                const added = isQueued(outcome.id);
                return (
                  <li key={outcome.id}>
                    <button
                      type="button"
                      className={`${rowClass} ${added ? "border-zinc-900 dark:border-zinc-100" : ""}`}
                      onClick={() =>
                        toggleTopic({
                          id: outcome.id,
                          title: outcome.title,
                          strand: strand.title,
                          subStrand: sub.title,
                        })
                      }
                    >
                      <span>{outcome.title}</span>
                      <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100">
                        {added ? "Added" : "Add"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-medium">
          {queued.length === 0
            ? "No topics selected yet"
            : `${queued.length} topic${queued.length === 1 ? "" : "s"} to save`}
        </p>
        {queued.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {queued.map((topic) => (
              <li
                key={topic.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span>
                  <span className="font-medium">{topic.title}</span>
                  <span className="block text-zinc-500">
                    {topic.strand} → {topic.subStrand}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-zinc-500 underline"
                  onClick={() => toggleTopic(topic)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Difficulty for these topics
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
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className={primaryButtonClass}
            disabled={pending || queued.length === 0}
            onClick={() => void save()}
          >
            {pending
              ? "Saving…"
              : queued.length === 0
                ? "Save topics"
                : `Save ${queued.length} topic${queued.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
