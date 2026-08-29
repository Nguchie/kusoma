"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

type AddStudentFormProps = {
  onCreated?: (student: {
    id: string;
    first_name: string;
    grade: number;
    phone: string;
  }) => void;
  onCancel?: () => void;
  title?: string;
};

export function AddStudentForm({
  onCreated,
  onCancel,
  title = "New student",
}: AddStudentFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [grade, setGrade] = useState("5");
  const [phone, setPhone] = useState("");
  const [includeGuardian, setIncludeGuardian] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [receivesReports, setReceivesReports] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName,
        grade: Number(grade),
        phone,
      };
      if (includeGuardian) {
        payload.guardian = {
          display_name: guardianName,
          phone: guardianPhone,
          receives_reports: receivesReports,
        };
      }

      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        id?: string;
        first_name?: string;
        grade?: number;
        phone?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not add student.");
        return;
      }
      if (onCreated) {
        onCreated({
          id: data.id ?? "",
          first_name: data.first_name ?? firstName,
          grade: data.grade ?? Number(grade),
          phone: data.phone ?? phone,
        });
        return;
      }
      router.push("/students");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <label className="flex flex-col gap-1 text-sm">
        First name
        <input
          required
          name="first_name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Grade
        <select
          name="grade"
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
          name="phone"
          type="tel"
          placeholder="07XX XXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeGuardian}
          onChange={(e) => setIncludeGuardian(e.target.checked)}
        />
        Add a guardian
      </label>
      {includeGuardian ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Guardian name
            <input
              required
              name="guardian_name"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Guardian phone
            <input
              required
              name="guardian_phone"
              type="tel"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={receivesReports}
              onChange={(e) => setReceivesReports(e.target.checked)}
            />
            Receives weekly reports
          </label>
        </>
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
        {onCancel ? (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
