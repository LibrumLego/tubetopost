// Read-only authentication probe: invalid job IDs never enqueue or process work.
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
const url = process.env.SUPABASE_WORKER_URL;
const secret = process.env.WORKER_SECRET;
if (!url || !secret) throw new Error("SUPABASE_WORKER_URL and WORKER_SECRET are required");
for (const [label, token, expected] of [["reject unauthenticated", "invalid-secret", 401], ["accept worker secret", secret, 400]]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: "invalid" }),
    signal: AbortSignal.timeout(15000),
  });
  console.log(`${label}: ${response.status}`);
  if (response.status !== expected) process.exitCode = 1;
}
