import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/** Service-role client. Bypasses RLS. Never import from Client Components. */
export function createAdminClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
