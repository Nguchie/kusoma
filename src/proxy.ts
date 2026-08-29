import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/update-session";

/**
 * Next.js 16: `proxy.ts` replaces deprecated `middleware.ts` (Guide Step 1.10).
 * Refreshes the tutor session. Does not require a JWT (login is Step 1.11).
 * Skips `/chat` and `/api/chat/*` / `/api/webhooks/*` — those are student/channel routes.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/students",
    "/students/:path*",
    "/reports",
    "/reports/:path*",
    "/payments",
    "/payments/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/login",
    "/login/:path*",
    "/signup",
    "/auth/:path*",
    "/api/((?!chat(?:/|$)|webhooks(?:/|$)|health(?:/|$)).*)",
  ],
};
