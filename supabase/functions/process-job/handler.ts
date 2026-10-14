import { createClient } from "@supabase/supabase-js";
import { fetchYoutubeMeta } from "./youtube-meta.ts";
import { fetchTranscript, fetchYoutubeDuration, TranscriptError } from "./transcript.ts";
import { fetchFromSupadata } from "./supadata.ts";
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
  const attemptId = crypto.randomUUID();
  const { data: claimed, error } = await supabase.rpc("claim_job_by_id", { p_job_id: jobId, p_attempt: attemptId });
  const job = claimed?.[0];
  if (error) return json({ error: "CLAIM_FAILED" }, 500);
  if (!job) return json({ skip: true, reason: "not_queued" });

  async function process() {
    let state = "transcribing";
    let stage = "metadata";
    const deadline = Date.now() + 120000;
    async function transition(next: string, fields: Record<string, unknown> = {}) {
      const result = await supabase.from("jobs").update({ ...fields, status: next, error_stage: null }).eq("id", jobId).eq("status", state).eq("attempt_id", attemptId).gt("lease_expires_at", new Date().toISOString()).select("id").maybeSingle();
      if (result.error || !result.data) throw new Error("STATE_TRANSITION_FAILED");
      state = next;
    }
    try {
      const meta = await fetchYoutubeMeta(job!.video_id);
      const duration = await fetchYoutubeDuration(job!.video_id);
      stage = "transcript";
      const transcript = await fetchFromSupadata(job!.video_id) ?? await fetchTranscript(job!.video_id);
      await transition("generating", { video_title: meta.title, video_thumbnail_url: meta.thumbnail, video_duration_sec: duration, transcript: transcript.transcript, transcript_source: transcript.source });
      const inputRate = Number(Deno.env.get("OPENAI_INPUT_USD_PER_MILLION"));
      const outputRate = Number(Deno.env.get("OPENAI_OUTPUT_USD_PER_MILLION"));
      if (!(inputRate > 0 && outputRate > 0 && Number.isFinite(inputRate) && Number.isFinite(outputRate))) throw new LlmError("PRICING_NOT_CONFIGURED");
      const generator = createGenerator(apiKey!, async (model, input, output) => {
        // Price estimates are configured rather than embedded as stale rates.
        const inputRate = Number(Deno.env.get("OPENAI_INPUT_USD_PER_MILLION"));
        const outputRate = Number(Deno.env.get("OPENAI_OUTPUT_USD_PER_MILLION"));
        const cost = Number.isFinite(inputRate) && Number.isFinite(outputRate) ? (input * inputRate + output * outputRate) / 1e6 : 0;
        const log = await supabase.from("usage_logs").insert({ user_id: job!.user_id, job_id: jobId, provider: "openai", operation: "chat", model, input_tokens: input, output_tokens: output, cost_usd: Math.max(0, cost) });
        if (log.error) throw new Error("USAGE_LOG_FAILED");
      }, async (bytes, outputLimit) => {
        if (Date.now() > deadline) throw new LlmError("JOB_TIMEOUT");
        const amount = (bytes * inputRate + outputLimit * outputRate) / 1e6;
        const reserved = await supabase.rpc("reserve_job_cost", { p_job_id: jobId, p_attempt: attemptId, p_amount: amount });
        if (reserved.error) throw new LlmError(reserved.error.code === "P0035" ? "COST_LIMIT" : "STALE_ATTEMPT");
      });
      stage = "outline";
      const outline = await generator.generateOutline(transcript.segments, meta.title, duration);
      stage = "sections";
      const sections = await generator.generateSections(outline, transcript.segments, job!.video_id);
      const markdown = sections.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n");
      stage = "seo";
      const seo = await generator.generateSeoMeta(outline.title, markdown);
      const html = renderMarkdown(markdown);
      if (Date.now() > deadline) throw new LlmError("JOB_TIMEOUT");
      await transition("finalizing");
      stage = "finalize";
      const finalized = await supabase.rpc("finalize_job", { p_job_id: jobId, p_attempt: attemptId, p_post: {
        title: outline.title, description: seo.meta_description, keywords: seo.keywords, slug: seo.slug_suggestion,
        content_markdown: markdown, content_html: html, cover_image_url: meta.thumbnail,
      } });
      if (finalized.error) throw new Error("FINALIZE_FAILED");
    } catch (error) {
      const code = error instanceof TranscriptError
        ? error.message === "SUPADATA_LIMITED" ? "TRANSCRIPT_PROVIDER_LIMITED"
          : error.message.startsWith("SUPADATA_") ? "INTERNAL"
          : error.message === "DURATION_UNAVAILABLE" ? "DURATION_UNAVAILABLE"
          : error.message === "VIDEO_TOO_LONG" || error.message === "TRANSCRIPT_TOO_LONG" ? "VIDEO_TOO_LONG" : "NO_TRANSCRIPT"
        : error instanceof LlmError ? ["COST_LIMIT", "JOB_TIMEOUT", "SOURCE_TOO_SHORT"].includes(error.message) ? error.message : "GENERATION_FAILED" : "INTERNAL";
      const message = code === "TRANSCRIPT_PROVIDER_LIMITED" ? "자막 공급자의 속도 또는 사용량 제한에 도달했습니다."
        : code === "VIDEO_TOO_LONG" ? "자막이 20분 구간 또는 처리 가능한 분량을 초과했습니다."
        : code === "NO_TRANSCRIPT" ? "자막을 가져오지 못했습니다. 자동 추출이 제한될 수 있습니다."
        : "변환에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      const failed = await supabase.from("jobs").update({ status: "failed", error_code: code, error_stage: stage, error_message: message, completed_at: new Date().toISOString() })
        .eq("id", jobId).eq("status", state).eq("attempt_id", attemptId);
      // Conditional failure cannot overwrite an already committed done result.
      if (failed.error) console.error("[process-job] failure status could not be saved", jobId);
      console.error("[process-job] failed", jobId, code, stage, error instanceof LlmError ? error.message : "");
    }
  }
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(process());
    return json({ accepted: true }, 202);
  }
  await process(); // Deno local runtime has no EdgeRuntime background facility.
  return json({ processed: true });
}

