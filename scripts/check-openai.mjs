import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
try {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", messages: [{ role: "user", content: "Reply OK." }], max_completion_tokens: 4 }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  console.log(JSON.stringify({ status: response.status, error_code: data.error?.code ?? null, error_type: data.error?.type ?? null, output_tokens: data.usage?.completion_tokens ?? 0 }));
  if (!response.ok) process.exitCode = 1;
} catch {
  console.log(JSON.stringify({ error_code: "NETWORK_OR_INVALID_RESPONSE" }));
  process.exitCode = 1;
}
