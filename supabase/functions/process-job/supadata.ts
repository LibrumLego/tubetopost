import { TranscriptError, type Segment } from "./types.ts";

export function parseSupadata(payload: unknown) {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { content?: unknown }).content)) throw new TranscriptError("SUPADATA_INVALID_RESPONSE");
  const content = (payload as { content: unknown[] }).content;
  if (!content.length) return null;
  const segments: Segment[] = [];
  let lastEnd = 0;
  for (const entry of content) {
    if (!entry || typeof entry !== "object") throw new TranscriptError("SUPADATA_INVALID_RESPONSE");
    const item = entry as { text?: unknown; offset?: unknown; duration?: unknown };
    if (typeof item.text !== "string" || !item.text.trim() || typeof item.offset !== "number" || !Number.isFinite(item.offset) || item.offset < 0 || typeof item.duration !== "number" || !Number.isFinite(item.duration) || item.duration < 0) throw new TranscriptError("SUPADATA_INVALID_RESPONSE");
    lastEnd = Math.max(lastEnd, (item.offset + item.duration) / 1000);
    segments.push({ start: item.offset / 1000, text: item.text.replace(/\s+/g, " ").trim() });
  }
  // Caption end is a lower bound on video length, not verified video duration.
  if (lastEnd > 1200) throw new TranscriptError("VIDEO_TOO_LONG");
  segments.sort((a, b) => a.start - b.start);
  const transcript = segments.map(s => s.text).join(" ");
  if (transcript.length > 50000) throw new TranscriptError("TRANSCRIPT_TOO_LONG");
  return { transcript, segments, source: "supadata" as const, duration: null };
}

export async function fetchFromSupadata(videoId: string) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new TranscriptError("INVALID_VIDEO_ID");
  const key = Deno.env.get("SUPADATA_API_KEY");
  if (!key) return null;
  const url = new URL("https://api.supadata.ai/v1/transcript");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("mode", "native");
  url.searchParams.set("text", "false");
  let response: Response;
  try {
    response = await fetch(url, { headers: { "x-api-key": key }, redirect: "error", signal: AbortSignal.timeout(20000) });
  } catch { throw new TranscriptError("SUPADATA_UNAVAILABLE"); }
  if ([202, 206, 404, 422].includes(response.status)) return null;
  if (response.status === 401) throw new TranscriptError("SUPADATA_UNAUTHORIZED");
  if (response.status === 429) throw new TranscriptError("SUPADATA_LIMITED");
  if (!response.ok) throw new TranscriptError("SUPADATA_UNAVAILABLE");
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new TranscriptError("SUPADATA_INVALID_RESPONSE"); }
  return parseSupadata(payload);
}
