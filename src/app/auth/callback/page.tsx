"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") ? value : "/dashboard";
}

function paramsFromUrl(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.search);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash) return params;
  new URLSearchParams(hash).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    async function finish() {
      const url = new URL(window.location.href);
      const params = paramsFromUrl(url);
      const next = safeNext(params.get("next"));
      const queryError =
        params.get("error_description") ?? params.get("error");

      if (queryError) {
        router.replace("/login?error=auth");
        return;
      }

      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = (params.get("type") ?? "email") as EmailOtpType;
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const supabase = createClient();

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          router.replace("/login?error=auth");
          return;
        }
        window.location.replace(next);
        return;
      }

      if (code) {
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          const detail = data?.error?.toLowerCase() ?? "";
          const mismatch =
            detail.includes("verifier") ||
            detail.includes("pkce") ||
            detail.includes("code challenge");
          router.replace(mismatch ? "/login?error=browser" : "/login?error=auth");
          return;
        }
        window.location.replace(next);
        return;
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (error) {
          router.replace("/login?error=auth");
          return;
        }
        window.location.replace(next);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.replace(next);
        return;
      }

      router.replace("/login?error=auth");
    }

    finish().catch(() => {
      setMessage("Could not complete sign-in.");
      router.replace("/login?error=auth");
    });
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
    </main>
  );
}
