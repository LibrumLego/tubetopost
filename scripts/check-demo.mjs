// Public HTTP checks: no cookies, service key, or generation requests.
import assert from "node:assert/strict";
const origin = new URL(process.argv[2] ?? process.env.APP_URL ?? "https://tubetopost.vercel.app").origin;
async function get(path, expected, redirect = "follow") {
  const response = await fetch(new URL(path, origin), { redirect, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, expected, `${path}: unexpected HTTP status`);
  console.log(`${path}: ${response.status}`);
  return response;
}
const landing = await get("/", 200);
assert.ok((await landing.text()).includes("/post/exploring-procrastin"), "Public showcase is missing");
await get("/login", 200);
const post = await get("/post/exploring-procrastin", 200);
assert.equal(new URL(post.url).origin, origin, "Public post redirected to another service");
const html = await post.text();
assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, "Expected one page title");
assert.ok(html.includes("원문 자막과 대조"), "Reviewed demo disclosure is missing");
assert.ok(html.includes("arj7oStGLkU"), "Original video source is missing");
assert.ok(html.includes(`rel="canonical" href="${origin}/post/exploring-procrastin"`), "Incorrect canonical URL");
const sitemap = await get("/sitemap.xml", 200);
const xml = await sitemap.text();
assert.ok(xml.includes(`${origin}/post/exploring-procrastin`), "Public post missing from sitemap");
assert.ok(!/<loc>[^<]*\/(?:app|api|auth|login)(?:[\/<])/.test(xml), "Private routes in sitemap");
const robots = await get("/robots.txt", 200);
const rules = await robots.text();
assert.ok(rules.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(rules.includes("Disallow: /app") && rules.includes("Disallow: /api"));
await get("/api/jobs", 401);
const protectedPage = await fetch(new URL("/app", origin), { redirect: "manual", signal: AbortSignal.timeout(20000) });
if (protectedPage.status === 307) {
  assert.equal(new URL(protectedPage.headers.get("location"), origin).pathname, "/login");
} else {
  // Next.js emits a client redirect when the response has already streamed.
  assert.equal(protectedPage.status, 200);
  const shell = await protectedPage.text();
  assert.match(shell, /<meta[^>]+http-equiv="refresh"[^>]+content="[^";]*;url=\/login"/);
}
console.log("/app: unauthenticated visitor redirected to login");
console.log("Public demo, source attribution, metadata and authentication checks passed.");
