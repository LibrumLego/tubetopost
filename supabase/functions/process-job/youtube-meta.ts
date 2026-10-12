export async function fetchYoutubeMeta(videoId: string) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("METADATA_FAILED");
  const data = await response.json();
  if (typeof data.title !== "string") throw new Error("METADATA_FAILED");
  return { title: data.title, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
}
