import "server-only";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

// Public content must not depend on the visitor's cookies or service-role access.
export async function createPublicClient() {
  await connection();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
