"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { AddStudentForm } from "@/components/tutor/add-student-form";
import { CurriculumBrowser } from "@/components/tutor/curriculum-browser";
import {
  inputClass,
  primaryButtonClass,
} from "@/components/tutor/styles";

type OnboardingStep = "profile" | "student" | "assignment" | "complete";

type OnboardingStudent = {
  id: string;
  first_name: string;
  grade: number;
  phone: string;
};

type AssignmentSummary = {
  learning_outcome: string;
};

type OnboardingStatus = {
  status: OnboardingStep;
  student: OnboardingStudent | null;
  assignment: AssignmentSummary | null;
};

const STEPS: OnboardingStep[] = ["profile", "student", "assignment", "complete"];

function stepIndex(status: OnboardingStep) {
  const index = STEPS.indexOf(status);
  return index < 0 ? 0 : index;
}

export function OnboardingFlow({
  initial,
  displayName,
  phone,
  chatUrl,
}: {
  initial: OnboardingStatus;
  displayName: string;
  phone: string;
  chatUrl: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status);
  const [student, setStudent] = useState<OnboardingStudent | null>(
    initial.student,
  );
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(
    initial.assignment,
  );
  const [name, setName] = useState(displayName);
  const [tutorPhone, setTutorPhone] = useState(phone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/onboarding/status");
    if (!response.ok) return;
    const data = (await response.json()) as OnboardingStatus;
    setStatus(data.status);
    setStudent(data.student);
    setAssignment(data.assignment);
  }, []);

  const screen: OnboardingStep =
    status === "complete"
      ? "complete"
      : status === "profile"
        ? "profile"
        : status === "student"
          ? "student"
          : assignment
            ? "complete"
            : "assignment";

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          phone: tutorPhone,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save profile.");
        return;
      }
      await refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function finish() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not finish onboarding.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const index = stepIndex(
    screen === "complete" && assignment ? "complete" : screen,
  );

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Step {Math.min(index + 1, 4)} of 4
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Get set up</h1>
      </div>

      {screen === "profile" ? (
        <form onSubmit={saveProfile} className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Your profile</h2>
          <label className="flex flex-col gap-1 text-sm">
            Display name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Phone
            <input
              required
              type="tel"
              value={tutorPhone}
              onChange={(event) => setTutorPhone(event.target.value)}
              className={inputClass}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "Saving…" : "Continue"}
          </button>
        </form>
      ) : null}

      {screen === "student" ? (
        <AddStudentForm
          title="Add your first student"
          onCreated={async () => {
            await refresh();
          }}
        />
      ) : null}

      {screen === "assignment" && student ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            Assign topics for {student.first_name}
          </h2>
          <p className="text-sm text-zinc-500">
            Add one or more CBC topics, then save.
          </p>
          <CurriculumBrowser
            grade={student.grade}
            studentId={student.id}
            onAssigned={() => void refresh()}
          />
        </div>
      ) : null}

      {screen === "complete" && student && assignment ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">You are ready</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {student.first_name} (Grade {student.grade}) is assigned{" "}
            <span className="font-medium">{assignment.learning_outcome}</span>.
          </p>
          <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <p className="font-medium">Student chat</p>
            <p className="mt-1 break-all">{chatUrl}</p>
            <p className="mt-2 text-zinc-500">
              Share that link. They enter this phone: {student.phone}
            </p>
          </div>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className={primaryButtonClass}
            disabled={pending}
            onClick={() => void finish()}
          >
            {pending ? "Finishing…" : "Go to dashboard"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
