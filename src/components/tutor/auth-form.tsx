"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";

type Mode = "login" | "signup";
type Channel = "email" | "sms" | "password";
type SignInMethod = "password" | "magic";

type AuthFormProps = {
  mode: Mode;
};

const pillClass = (active: boolean) =>
  `rounded-full px-3 py-1 ${
    active
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "border border-zinc-300 dark:border-zinc-700"
  }`;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signInMethod, setSignInMethod] = useState<SignInMethod | null>(null);
  const [signupMethod, setSignupMethod] = useState<SignInMethod>("password");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Channel | null>(null);

  const usingPassword =
    mode === "signup"
      ? signupMethod === "password"
      : signInMethod === "password";

  const title = mode === "signup" ? "Create your tutor account" : "Sign in";
  const submitLabel = useMemo(() => {
    if (pending) {
      if (usingPassword) {
        return mode === "signup" ? "Creating account…" : "Signing in…";
      }
      return "Sending…";
    }
    if (usingPassword) {
      return mode === "signup" ? "Create account" : "Sign in";
    }
    return "Send magic link";
  }, [mode, pending, usingPassword]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(null);

    if (usingPassword && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signup" && usingPassword && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);

    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      let payload: Record<string, string | undefined>;

      if (mode === "signup") {
        payload = {
          display_name: displayName,
          phone,
          email: email.trim() || undefined,
          password: usingPassword ? password : undefined,
        };
      } else if (usingPassword) {
        payload = { email, password };
      } else {
        payload = { email };
      }

      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        error?: string;
        channel?: Channel;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      if (data.channel === "password") {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (data.channel === "sms") {
        const params = new URLSearchParams({ phone });
        router.push(`/login/verify?${params.toString()}`);
        return;
      }

      setSent(data.channel ?? "email");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  function openSignIn(method: SignInMethod) {
    setSignInMethod(method);
    setError(null);
    setSent(null);
  }

  if (mode === "login" && signInMethod === null) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Choose how you want to continue.
        </p>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => openSignIn("password")}
        >
          Continue with email/password
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => openSignIn("magic")}
        >
          Continue with magic link
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {mode === "login" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {signInMethod === "password"
            ? "Sign in with the email and password for your tutor account."
            : "We’ll email a sign-in link. Open it in this same browser."}
        </p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Email and password works without sending mail. Magic link stays
          available.
        </p>
      )}

      {mode === "signup" ? (
        <>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSignupMethod("password")}
              className={pillClass(signupMethod === "password")}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setSignupMethod("magic")}
              className={pillClass(signupMethod === "magic")}
            >
              Magic link
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input
              required
              name="display_name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Phone
            <input
              required
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              required={usingPassword}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={
                usingPassword ? "Required" : "Needed for magic link"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          {usingPassword ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Password
                <input
                  required
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Confirm password
                <input
                  required
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              Magic link uses email. Phone OTP needs Twilio on the Supabase
              project.
            </p>
          )}
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          {signInMethod === "password" ? (
            <label className="flex flex-col gap-1 text-sm">
              Password
              <input
                required
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
          ) : null}
        </>
      )}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {sent === "email" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Check your email for the magic link. Open it in this same browser —
          copy the URL if the mail app opens its own window.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {submitLabel}
      </button>

      {mode === "login" ? (
        <button
          type="button"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
          onClick={() => {
            setSignInMethod(null);
            setError(null);
            setSent(null);
          }}
        >
          Choose a different way
        </button>
      ) : null}
    </form>
  );
}
