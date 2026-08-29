import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Kusoma</h1>
      <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
        Homework help for CBC learners.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Tutor sign in
        </Link>
        <Link
          href="/chat"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Student chat
        </Link>
      </div>
    </main>
  );
}
