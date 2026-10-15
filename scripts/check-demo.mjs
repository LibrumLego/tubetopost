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
const landingHtml = await landing.text();
const configuredSlug = process.env.DEMO_SLUG;
if (configuredSlug !== undefined) assert.match(configuredSlug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid DEMO_SLUG");
const discoveredSlug = landingHtml.match(/href="\/post\/([a-z0-9]+(?:-[a-z0-9]+)*)"/)?.[1];
const slug = configuredSlug ?? discoveredSlug;
await get("/login", 200);
if (slug) {
  const path = `/post/${slug}`;
  const post = await get(path, 200);
  assert.equal(new URL(post.url).origin, origin, "Public post redirected to another service");
  const html = await post.text();
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, "Expected one page title");
  assert.match(html, /https:\/\/(?:www\.)?youtube\.com\/watch\?v=/, "Original video source is missing");
  assert.ok(html.includes(`rel="canonical" href="${origin}${path}"`), "Incorrect canonical URL");
} else {
  console.log("SKIP public article check: no article link on landing. This does not verify content readiness.");
}
const sitemap = await get("/sitemap.xml", 200);
const xml = await sitemap.text();
if (/<loc>[^<]+\/post\//.test(xml)) assert.ok(discoveredSlug, "Public sitemap has articles but landing showcase is missing");
if (slug) assert.ok(xml.includes(`${origin}/post/${slug}</loc>`), "Public post missing from sitemap");
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
console.log("Available public content, discovery, metadata and authentication checks passed.");
