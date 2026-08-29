import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Kusoma’s tutor shell is cached on this device. Student data still needs
        a connection.
      </p>
      <Link href="/dashboard" className="text-sm underline">
        Try the dashboard
      </Link>
    </main>
  );
}
