const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

export function parseYouTubeUrl(input: unknown): { videoId: string; url: string } | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  try {
    const url = new URL(input.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    let videoId: string | null = null;
    if (url.hostname === "youtu.be") {
      videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
    } else if (HOSTS.has(url.hostname)) {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v");
      else videoId = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
    }
    if (!videoId || !VIDEO_ID.test(videoId)) return null;
    return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  } catch {
    return null;
  }
}
