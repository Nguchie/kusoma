"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not verify that code.");
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

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        We sent a one-time code to {phone || "your phone"}.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Code
        <input
          required
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base tracking-widest text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !phone}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <Suspense>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
