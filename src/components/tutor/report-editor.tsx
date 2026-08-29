"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

export function ReportEditor({
  reportId,
  initialBody,
  initialStatus,
}: {
  reportId: string;
  initialBody: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = status === "sent";

  async function save(nextStatus?: "approved") {
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, string> = { report_body: body };
      if (nextStatus) payload.status = nextStatus;
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        status?: string;
        report_body?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      if (data.status) setStatus(data.status);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function send() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
      });
      const data = (await response.json()) as { status?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not send.");
        return;
      }
      if (data.status) setStatus(data.status);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="min-h-48 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        value={body}
        disabled={locked || pending}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {locked ? (
        <p className="text-sm text-zinc-500">Sent. This copy is locked.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={pending}
            onClick={() => void save()}
          >
            Save
          </button>
          {status === "draft" ? (
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={pending}
              onClick={() => void save("approved")}
            >
              Approve
            </button>
          ) : null}
          {status === "approved" ? (
            <button
              type="button"
              className={primaryButtonClass}
              disabled={pending}
              onClick={() => void send()}
            >
              Mark sent
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
