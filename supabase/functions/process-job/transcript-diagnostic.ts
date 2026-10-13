import { extractPlayer } from "./transcript.ts";

const videoId = Deno.args[0];
if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Pass an 11-character video ID");
const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
  headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ko,en;q=0.8" },
  signal: AbortSignal.timeout(15000),
});
const html = await response.text();
console.log(JSON.stringify({ stage: "watch", status: response.status, bytes: html.length }));
const player = extractPlayer(html);
const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
console.log(JSON.stringify({ stage: "tracks", count: tracks.length }));
const preferred = tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr") ?? tracks.find((t) => t.languageCode === "ko") ?? tracks.find((t) => t.kind !== "asr") ?? tracks[0];
for (const track of preferred ? [preferred] : []) {
  const url = new URL(track.baseUrl);
  if (url.protocol !== "https:" || !["www.youtube.com", "youtube.com"].includes(url.hostname)) continue;
  url.searchParams.set("fmt", "json3");
  const captions = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
  const body = await captions.text();
  let json = false;
  try { JSON.parse(body); json = true; } catch { /* Empty or non-JSON body. */ }
  console.log(JSON.stringify({ stage: "captions", language: track.languageCode, exp: url.searchParams.get("exp"), hasPoToken: url.searchParams.has("pot"), status: captions.status, contentType: captions.headers.get("content-type"), bytes: body.length, json }));
}
