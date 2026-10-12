import { fetchTranscript } from "./transcript.ts";

const videoId = Deno.args[0];
if (!videoId) throw new Error("Usage: deno run --allow-net transcript-poc.ts <video-id>");
try {
  const result = await fetchTranscript(videoId);
  console.log(JSON.stringify({ videoId, source: result.source, characters: result.transcript.length, segments: result.segments.length, duration: result.duration }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "TRANSCRIPT_FAILED");
  Deno.exit(1);
}
