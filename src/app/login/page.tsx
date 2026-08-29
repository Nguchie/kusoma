import { AuthForm } from "@/components/tutor/auth-form";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage =
    params.error === "browser"
      ? "Open the magic link in this same browser (copy the URL from the email if your mail app opened a different one)."
      : params.error === "auth"
        ? "That sign-in link is invalid or expired. Request a new one and open it in the same browser."
        : params.error === "missing_code"
          ? "That sign-in link did not include a session. Request a new magic link and open it on this same device."
          : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      {errorMessage ? (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
      <AuthForm mode="login" />
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        New tutor?{" "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
