import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db";

export function createBrowserClient() {
  return _createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
