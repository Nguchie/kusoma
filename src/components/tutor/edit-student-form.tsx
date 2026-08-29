"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

type Guardian = {
  id: string;
  display_name: string;
  phone: string;
  receives_reports: boolean;
};

type EditStudentFormProps = {
  student: {
    id: string;
    first_name: string;
    grade: number;
    phone: string;
    nudge_time: string | null;
    is_active: boolean;
    guardians: Guardian[];
  };
};

function timeInputValue(nudgeTime: string | null): string {
  if (!nudgeTime) return "15:00";
  return nudgeTime.slice(0, 5);
}

export function EditStudentForm({ student }: EditStudentFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(student.first_name);
  const [grade, setGrade] = useState(String(student.grade));
  const [phone, setPhone] = useState(student.phone);
  const [nudgeTime, setNudgeTime] = useState(timeInputValue(student.nudge_time));
  const [isActive, setIsActive] = useState(student.is_active);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          grade: Number(grade),
          phone,
          nudge_time: nudgeTime,
          is_active: isActive,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onDeactivate() {
    if (!window.confirm(`Deactivate ${student.first_name}? They can be reactivated later.`)) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not deactivate.");
        return;
      }
      setIsActive(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        First name
        <input
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Grade
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className={inputClass}
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Phone
        <input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Daily nudge time
        <input
          type="time"
          value={nudgeTime}
          onChange={(e) => setNudgeTime(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active
      </label>

      {student.guardians.length > 0 ? (
        <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <p className="mb-1 font-medium">Guardians</p>
          <ul className="flex flex-col gap-1">
            {student.guardians.map((guardian) => (
              <li key={guardian.id}>
                {guardian.display_name} · {guardian.phone}
                {guardian.receives_reports ? " · reports" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
        {student.is_active ? (
          <button
            type="button"
            disabled={pending}
            onClick={onDeactivate}
            className={secondaryButtonClass}
          >
            Deactivate
          </button>
        ) : null}
      </div>
    </form>
  );
}
