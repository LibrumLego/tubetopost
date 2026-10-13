import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const VIDEO_IDS = ["arj7oStGLkU", "dQw4w9WgXcQ", "jNQXAC9IVRw"];

export function countUsableSegments(payload) {
  if (!Array.isArray(payload?.content)) return 0;
  if (!payload.content.every((s) => typeof s?.text === "string" && s.text.trim() && Number.isFinite(s.offset) && s.offset >= 0 && Number.isFinite(s.duration) && s.duration >= 0)) return 0;
  return payload.content.length;
}

export async function runPoc(apiKey, fetcher = fetch, emit = console.log) {
  if (!apiKey || !apiKey.trim() || apiKey.startsWith("TODO_")) {
    emit(JSON.stringify({ error: "SUPADATA_API_KEY_MISSING", requests: 0 }));
    return 1;
  }
  let successes = 0;
  for (const videoId of VIDEO_IDS) {
    // Free plan allows one request per second.
    if (videoId !== VIDEO_IDS[0]) await delay(1100);
    const url = new URL("https://api.supadata.ai/v1/transcript");
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
    url.searchParams.set("mode", "native");
    url.searchParams.set("text", "false");
    let status = 0, count = 0;
    try {
      const response = await fetcher(url, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      status = response.status;
      // No retries or async polling: at most three paid transcript requests.
      if (status === 200) count = countUsableSegments(await response.json());
    } catch { /* Never print errors that may contain credentials or response text. */ }
    const usable = status === 200 && count > 0;
    if (usable) successes++;
    emit(JSON.stringify({ video_id: videoId, status, segments_count: count, usable }));
    if ([401, 402, 403, 429].includes(status)) break;
  }
  return successes >= 2 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { loadEnvFile(".env.local"); } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(JSON.stringify({ error: "ENV_LOAD_FAILED", requests: 0 }));
      process.exit(1);
    }
  }
  process.exitCode = await runPoc(process.env.SUPADATA_API_KEY);
}
