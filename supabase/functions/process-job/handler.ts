import { createClient } from "@supabase/supabase-js";
import { fetchYoutubeMeta } from "./youtube-meta.ts";
import { fetchTranscript, TranscriptError } from "./transcript.ts";
import { createGenerator, LlmError } from "./llm.ts";
import { renderMarkdown } from "./markdown.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const workerSecret = Deno.env.get("WORKER_SECRET");
  if (!key || !url || !workerSecret) return json({ error: "NOT_CONFIGURED" }, 503);
  // Use a dedicated shared secret because Supabase auto-injected keys
  // may not match the Legacy JWT the Next.js app has in its env.
  if (request.headers.get("authorization") !== `Bearer ${workerSecret}`) return json({ error: "UNAUTHORIZED" }, 401);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "NOT_CONFIGURED" }, 503);
  let jobId: string;
  try {
    const body = await request.json();
    if (typeof body.job_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.job_id)) return json({ error: "INVALID_JOB_ID" }, 400);
    jobId = body.job_id;
  } catch { return json({ error: "INVALID_JSON" }, 400); }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Claim precisely the requested job with a compare-and-set, not a read then write.
  const { data: job, error } = await supabase.from("jobs").update({ status: "transcribing", started_at: new Date().toISOString() })
    .eq("id", jobId).eq("status", "queued").select("id,user_id,video_id").maybeSingle();
  if (error) return json({ error: "CLAIM_FAILED" }, 500);
  if (!job) return json({ skip: true, reason: "not_queued" });

  async function process() {
    let state = "transcribing";
    async function transition(next: string, fields: Record<string, unknown> = {}) {
      const result = await supabase.from("jobs").update({ ...fields, status: next }).eq("id", jobId).eq("status", state).select("id").maybeSingle();
      if (result.error || !result.data) throw new Error("STATE_TRANSITION_FAILED");
      state = next;
    }
    try {
      const meta = await fetchYoutubeMeta(job!.video_id);
      const transcript = await fetchTranscript(job!.video_id);
      await transition("generating", { video_title: meta.title, video_thumbnail_url: meta.thumbnail, video_duration_sec: transcript.duration, transcript: transcript.transcript, transcript_source: transcript.source });
      const generator = createGenerator(apiKey!, async (model, input, output) => {
        // Price estimates are configured rather than embedded as stale rates.
        const inputRate = Number(Deno.env.get("OPENAI_INPUT_USD_PER_MILLION"));
        const outputRate = Number(Deno.env.get("OPENAI_OUTPUT_USD_PER_MILLION"));
        const cost = Number.isFinite(inputRate) && Number.isFinite(outputRate) ? (input * inputRate + output * outputRate) / 1e6 : 0;
        const log = await supabase.from("usage_logs").insert({ user_id: job!.user_id, job_id: jobId, provider: "openai", operation: "chat", model, input_tokens: input, output_tokens: output, cost_usd: Math.max(0, cost) });
        if (log.error) throw new Error("USAGE_LOG_FAILED");
      });
      const outline = await generator.generateOutline(transcript.segments, meta.title);
      const sections = await generator.generateSections(outline, transcript.segments, job!.video_id);
      const markdown = `# ${outline.title}\n\n${sections.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n")}`;
      const seo = await generator.generateSeoMeta(outline.title, markdown);
      const html = renderMarkdown(markdown);
      await transition("finalizing");
      const finalized = await supabase.rpc("finalize_job", { p_job_id: jobId, p_post: {
        title: outline.title, description: seo.meta_description, keywords: seo.keywords, slug: seo.slug_suggestion,
        content_markdown: markdown, content_html: html, cover_image_url: meta.thumbnail,
      } });
      if (finalized.error) throw new Error("FINALIZE_FAILED");
    } catch (error) {
      const code = error instanceof TranscriptError ? "NO_TRANSCRIPT" : error instanceof LlmError ? "GENERATION_FAILED" : "INTERNAL";
      const message = code === "NO_TRANSCRIPT" ? "자막을 가져올 수 없습니다. 자막이 있는 다른 영상을 시도해 주세요." : "변환에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      const failed = await supabase.from("jobs").update({ status: "failed", error_code: code, error_message: message, completed_at: new Date().toISOString() })
        .eq("id", jobId).eq("status", state);
      // Conditional failure cannot overwrite an already committed done result.
      if (failed.error) console.error("[process-job] failure status could not be saved", jobId);
      console.error("[process-job] failed", jobId, code);
    }
  }
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(process());
    return json({ accepted: true }, 202);
  }
  await process(); // Deno local runtime has no EdgeRuntime background facility.
  return json({ processed: true });
}

