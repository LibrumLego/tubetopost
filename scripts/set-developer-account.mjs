// Administrative command. Never import into client code or an HTTP route.
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
loadEnvFile(".env.local");
const userId = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? "")) {
  throw new Error("Usage: node scripts/set-developer-account.mjs <existing-user-uuid>");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server configuration is required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.from("profiles").update({ plan: "developer", monthly_quota: 30 })
  .eq("id", userId).select("id,plan,monthly_quota,used_this_month").single();
if (error) throw new Error(`Developer account update failed (${error.code})`);
console.log(JSON.stringify(data));
