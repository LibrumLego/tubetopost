import { TranscriptError, type Segment } from "./types.ts";
export { TranscriptError } from "./types.ts";

interface CaptionTrack { baseUrl: string; languageCode: string; kind?: string }
interface Player { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }; videoDetails?: { lengthSeconds?: string } }

export function extractPlayer(html: string): Player {
  const match = /(?:var\s+)?ytInitialPlayerResponse\s*=\s*/.exec(html);
  if (!match) throw new TranscriptError("NO_PLAYER_RESPONSE");
  const start = html.indexOf("{", match.index + match[0].length);
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i >= 0 && i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { break; }
    }
  }
  throw new TranscriptError("INVALID_PLAYER_RESPONSE");
}

export function parseCaptions(data: { events?: { tStartMs?: number; segs?: { utf8?: string }[] }[] }): Segment[] {
  if (!Array.isArray(data.events)) throw new TranscriptError("EMPTY_CAPTIONS");
  const segments: Segment[] = [];
  for (const event of data.events) {
    const text = event.segs?.map((part) => part.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (text && text !== segments.at(-1)?.text) segments.push({ start: (event.tStartMs ?? 0) / 1000, text });
  }
  if (!segments.length) throw new TranscriptError("EMPTY_CAPTIONS");
  return segments;
}

export async function fetchTranscript(videoId: string) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new TranscriptError("INVALID_VIDEO_ID");
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ko,en;q=0.8" }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new TranscriptError("VIDEO_UNAVAILABLE");
    const player = extractPlayer(await response.text());
    const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) throw new TranscriptError("NO_CAPTIONS");
    const track = tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr") ?? tracks.find((t) => t.languageCode === "ko") ?? tracks.find((t) => t.kind !== "asr") ?? tracks[0];
    const url = new URL(track.baseUrl);
    if (url.protocol !== "https:" || !["www.youtube.com", "youtube.com"].includes(url.hostname) || url.username || url.password) throw new TranscriptError("INVALID_CAPTION_URL");
    url.searchParams.set("fmt", "json3");
    const captions = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!captions.ok) throw new TranscriptError("CAPTIONS_UNAVAILABLE");
    const segments = parseCaptions(await captions.json());
    const transcript = segments.map((s) => s.text).join(" ");
    // Bound MVP cost. Longer videos need the future chunk/summarize pipeline.
    if (transcript.length > 50000) throw new TranscriptError("TRANSCRIPT_TOO_LONG");
    const duration = Number(player.videoDetails?.lengthSeconds);
    return { transcript, segments, source: "youtube_captions" as const, duration: Number.isFinite(duration) && duration >= 0 ? duration : null };
  } catch (error) {
    if (error instanceof TranscriptError) throw error;
    throw new TranscriptError("CAPTIONS_UNAVAILABLE");
  }
}
