/**
 * Import from the file that matches the runtime:
 * - `@/lib/supabase/client` — browser (`createBrowserClient`)
 * - `@/lib/supabase/server` — App Router cookies (`createClient`, `getUser`)
 * - `@/lib/supabase/admin` — service role, server only
 *
 * Do not barrel-export those from here — `admin` must never land in a client bundle.
 */
export {};
