"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

type StudentOption = { id: string; first_name: string };

export function PaymentForm({
  students,
  defaultMonth,
}: {
  students: StudentOption[];
  defaultMonth: string;
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [periodMonth, setPeriodMonth] = useState(defaultMonth.slice(0, 7));
  const [status, setStatus] = useState("completed");
  const [receipt, setReceipt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          amount: Number(amount),
          period_month: periodMonth,
          status,
          mpesa_receipt: receipt || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save payment.");
        return;
      }
      setAmount("");
      setReceipt("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Add a student before recording a payment.</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Student
        <select
          className={inputClass}
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.first_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Amount (KES)
        <input
          required
          type="number"
          min={1}
          step={1}
          className={inputClass}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Month
        <input
          required
          type="month"
          className={inputClass}
          value={periodMonth}
          onChange={(event) => setPeriodMonth(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          className={inputClass}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="completed">Paid (cash / M-Pesa)</option>
          <option value="pending">Pending</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        M-Pesa receipt (optional)
        <input
          className={inputClass}
          value={receipt}
          onChange={(event) => setReceipt(event.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={secondaryButtonClass}
      disabled={pending}
      onClick={() => void onClick()}
    >
      {pending ? "Saving…" : "Mark paid"}
    </button>
  );
}
