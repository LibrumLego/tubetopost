import { after } from "next/server";

export function dispatchJob(id: string) {
  const url = process.env.SUPABASE_WORKER_URL;
  const key = process.env.WORKER_SECRET;
  if (!url || !key) return;
  after(async () => {
    try {
      const response = await fetch(url, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: id }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) console.error("[jobs] dispatch rejected", id, response.status);
    } catch { console.error("[jobs] dispatch unavailable", id); }
  });
}
