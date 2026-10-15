export function visitPage(path: string): string | null {
  if (path === "/") return "landing";
  if (path === "/login") return "login";
  if (path === "/app") return "app";
  if (/^\/post\/[^/]+$/.test(path)) return "public_post";
  return null;
}

export function visitSource(referrer: string, origin: string): string {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    if (url.origin === origin) return "internal";
    if (/(^|\.)(google\.[a-z.]+|bing\.com|search\.naver\.com|search\.daum\.net)$/.test(url.hostname)) return "search";
    if (/(^|\.)(x\.com|t\.co|twitter\.com|threads\.net|threads\.com|facebook\.com|instagram\.com|disquiet\.io|news\.hada\.io)$/.test(url.hostname)) return "social";
    return "other";
  } catch { return "other"; }
}
