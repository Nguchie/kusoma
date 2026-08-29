import { AuthForm } from "@/components/tutor/auth-form";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <AuthForm mode="signup" />
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
