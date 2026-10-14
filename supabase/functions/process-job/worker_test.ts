import { extractPlayer, parseCaptions } from "./transcript.ts";
import { renderMarkdown } from "./markdown.ts";
import { handler } from "./handler.ts";
import { isOutline, isSeoMeta } from "./llm.ts";
import { parseSupadata } from "./supadata.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition { if (!condition) throw new Error(message); }

Deno.test("captions preserve timestamps; parser handles braces in quoted strings", () => {
  const player = extractPlayer('var ytInitialPlayerResponse = {"videoDetails":{"lengthSeconds":"12"},"title":"a }; b"};');
  assert(player.videoDetails?.lengthSeconds === "12");
  const segments = parseCaptions({ events: [{ tStartMs: 1000, segs: [{ utf8: "hello" }] }, { tStartMs: 2000, segs: [{ utf8: "hello" }] }, { tStartMs: 3000, segs: [{ utf8: "world" }] }] });
  assert(segments.length === 2 && segments[1].start === 3);
  let rejected = false;
  try { parseCaptions({ events: [] }); } catch { rejected = true; }
  assert(rejected);
});

Deno.test("rendered HTML removes scripts, handlers and dangerous link schemes", () => {
  const html = renderMarkdown('# Title\n<script>alert(1)</script><img src=x onerror=alert(1)>\n[bad](javascript:alert) [good](https://example.com)');
  assert(!html.includes("<script") && !html.includes("onerror") && !html.includes("javascript:") && !html.includes("<img"));
  assert(html.includes('href="https://example.com"'));
});

Deno.test("LLM output schemas reject malformed structures", () => {
  assert(!isOutline({ title: "title", sections: [{ heading: "bad" }] }));
  assert(!isSeoMeta({ meta_title: "title", meta_description: "desc", keywords: [], slug_suggestion: "../bad" }));
});

Deno.test("worker authenticates before DB access and validates request", async () => {
  Deno.env.set("WORKER_SECRET", "test-worker-secret");
  Deno.env.set("SUPABASE_URL", "https://db.example.com"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key"); Deno.env.set("OPENAI_API_KEY", "test-openai");
  assert((await handler(new Request("https://worker", { method: "GET" }))).status === 405);
  assert((await handler(new Request("https://worker", { method: "POST", headers: { Authorization: "Bearer user-jwt" } }))).status === 401);
  assert((await handler(new Request("https://worker", { method: "POST", headers: { Authorization: "Bearer test-key" }, body: '{"job_id":"bad"}' }))).status === 401);
  assert((await handler(new Request("https://worker", { method: "POST", headers: { Authorization: "Bearer test-worker-secret" }, body: '{"job_id":"bad"}' }))).status === 400);
  Deno.env.delete("WORKER_SECRET");
  assert((await handler(new Request("https://worker", { method: "POST" }))).status === 503);
});

for (const scenario of ["success", "no_captions", "duplicate", "claim_error", "llm_error", "supadata_success", "supadata_401", "supadata_404", "supadata_429", "supadata_202", "supadata_206"] as const) {
  Deno.test(`worker mocked pipeline: ${scenario}`, async () => {
    Deno.env.set("WORKER_SECRET", "test-worker-secret");
    if (scenario.startsWith("supadata_")) Deno.env.set("SUPADATA_API_KEY", "test-supadata");
    else Deno.env.delete("SUPADATA_API_KEY");
    Deno.env.set("SUPABASE_URL", "https://db.example.com"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key"); Deno.env.set("OPENAI_API_KEY", "test-openai");
    const original = globalThis.fetch;
    const jobId = "11111111-1111-4111-8111-111111111111";
    const states: string[] = [];
    let finalized = false, calls = 0, source: string | null = null, failureCode: string | null = null;
    const outline = { title: "Test title", sections: Array.from({ length: 4 }, (_, i) => ({ heading: `Section ${i}`, points: ["a", "b"], source_timestamp: 0 })) };
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.hostname === "db.example.com") {
        if (url.pathname.endsWith("/jobs")) {
          const body = await request.json(); states.push(body.status);
          if (body.transcript_source) source = body.transcript_source;
          if (body.error_code) failureCode = body.error_code;
          if (states.length === 1 && scenario === "claim_error") return Response.json({ message: "DB unavailable" }, { status: 500 });
          if (states.length === 1 && scenario === "duplicate") return Response.json(null);
          return Response.json(states.length === 1 ? { id: jobId, user_id: jobId, video_id: "dQw4w9WgXcQ" } : { id: jobId });
        }
        if (url.pathname.endsWith("/usage_logs")) return new Response(null, { status: 201 });
        if (url.pathname.endsWith("/finalize_job")) { finalized = true; return Response.json({ id: jobId }); }
      }
      if (url.pathname === "/oembed") return Response.json({ title: "Video title" });
      if (url.hostname === "api.supadata.ai") {
        assert(url.searchParams.get("mode") === "native");
        const status = scenario === "supadata_success" ? 200 : Number(scenario.split("_")[1]);
        return Response.json(status === 200 ? { content: [{ text: "source transcript", offset: 1000, duration: 1000 }] } : {}, { status });
      }
      if (url.pathname === "/watch") return new Response(`var ytInitialPlayerResponse = ${JSON.stringify({ captions: scenario === "no_captions" ? {} : { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: "ko", baseUrl: "https://www.youtube.com/api/timedtext?v=test" }] } }, videoDetails: { lengthSeconds: "60" } })};`);
      if (url.pathname === "/api/timedtext") return Response.json({ events: [{ tStartMs: 0, segs: [{ utf8: "source transcript" }] }] });
      if (url.hostname === "api.openai.com") {
        if (scenario === "llm_error") return Response.json({ error: { message: "invalid key" } }, { status: 401 });
        calls++;
        const content = calls === 1 ? JSON.stringify(outline) : calls === 6 ? JSON.stringify({ meta_title: "title", meta_description: "desc", keywords: ["a", "b", "c", "d", "e"], slug_suggestion: "test-post" }) : "section body";
        return Response.json({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 10 } });
      }
      throw new Error(`Unexpected request ${request.url}`);
    };
    try {
      const response = await handler(new Request("https://worker", { method: "POST", headers: { Authorization: "Bearer test-worker-secret" }, body: JSON.stringify({ job_id: jobId }) }));
      if (["success", "supadata_success", "supadata_404", "supadata_202", "supadata_206"].includes(scenario)) {
        assert(finalized && states.join(",") === "transcribing,generating,finalizing" && calls === 6, `states=${states} calls=${calls} finalized=${finalized}`);
        assert(source === (scenario === "supadata_success" ? "supadata" : "youtube_captions"));
      }
      else if (scenario === "duplicate") assert(!finalized && states.length === 1);
      else if (scenario === "claim_error") assert(response.status === 500 && !finalized);
      else assert(states.at(-1) === "failed" && !finalized);
      if (scenario === "supadata_401") assert(failureCode === "INTERNAL");
      if (scenario === "supadata_429") assert(failureCode === "TRANSCRIPT_PROVIDER_LIMITED");
    } finally { globalThis.fetch = original; Deno.env.delete("SUPADATA_API_KEY"); }
  });
}

Deno.test("provider rejects malformed, excessive and long captions without invented duration", () => {
  for (const content of [[{ text: "x", offset: -1, duration: 0 }], [{ text: "x", offset: 1200000, duration: 1 }], [{ text: "x".repeat(50001), offset: 0, duration: 1 }]]) {
    let rejected = false;
    try { parseSupadata({ content }); } catch { rejected = true; }
    assert(rejected);
  }
  assert(parseSupadata({ content: [] }) === null);
  const value = parseSupadata({ content: [{ text: "caption", offset: 1500, duration: 500 }] });
  assert(value?.segments[0].start === 1.5 && value.duration === null);
});
