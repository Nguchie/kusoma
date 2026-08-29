"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddStudentForm } from "@/components/tutor/add-student-form";
import { primaryButtonClass, secondaryButtonClass } from "@/components/tutor/styles";

type StudentListItem = {
  id: string;
  first_name: string;
  grade: number;
  phone: string;
  is_active: boolean;
};

export function StudentsRoster({ students }: { students: StudentListItem[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  function closeForm() {
    setAdding(false);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Open a student to assign a Mathematics topic.
          </p>
        </div>
        {adding ? (
          <button
            type="button"
            onClick={() => setAdding(false)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={primaryButtonClass}
          >
            Add student
          </button>
        )}
      </div>

      {adding ? (
        <AddStudentForm onCancel={() => setAdding(false)} onCreated={closeForm} />
      ) : students.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No students yet. Use Add student to enroll the first one.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {students.map((student) => (
            <li key={student.id}>
              <Link
                href={`/students/${student.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">{student.first_name}</p>
                  <p className="text-sm text-zinc-500">
                    Grade {student.grade} · {student.phone}
                  </p>
                </div>
                <span className="text-xs text-zinc-500">
                  {student.is_active ? "Active" : "Inactive"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
