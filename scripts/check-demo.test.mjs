import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

async function probe({ articles = [], showcase = articles, selected } = {}) {
  let origin;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const path = request.url;
    if (path === "/") return response.end(showcase.map(slug => `<a href="/post/${slug}">Read</a>`).join(""));
    if (path === "/login") return response.end("Login");
    if (path === "/api/jobs") { response.statusCode = 401; return response.end(); }
    if (path === "/app") { response.statusCode = 307; response.setHeader("Location", "/login"); return response.end(); }
    if (path === "/robots.txt") return response.end(`Disallow: /app\nDisallow: /api\nSitemap: ${origin}/sitemap.xml`);
    if (path === "/sitemap.xml") return response.end(`<urlset><url><loc>${origin}</loc></url>${articles.map(slug => `<url><loc>${origin}/post/${slug}</loc></url>`).join("")}</urlset>`);
    if (articles.includes(path.slice("/post/".length)) && path.startsWith("/post/")) {
      return response.end(`<h1>Article</h1><link rel="canonical" href="${origin}${path}"><a href="https://www.youtube.com/watch?v=abc123abc12">Source</a>`);
    }
    response.statusCode = 404;
    response.end("Not found");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const env = { ...process.env, APP_URL: origin };
    delete env.DEMO_SLUG;
    if (selected !== undefined) env.DEMO_SLUG = selected;
    const child = spawn(process.execPath, ["scripts/check-demo.mjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => output += chunk);
    child.stderr.on("data", chunk => output += chunk);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    return { code, output };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("discovers a replacement article without relying on the original demo", async () => {
  const result = await probe({ articles: ["new-public-article"] });
  assert.equal(result.code, 0, result.output);
});
test("can explicitly inspect an older article outside the six-card showcase", async () => {
  const result = await probe({ articles: ["new-article", "older-article"], showcase: ["new-article"], selected: "older-article" });
  assert.equal(result.code, 0, result.output);
});
test("an empty site skips article validation while still checking auth and discovery", async () => {
  const result = await probe();
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /SKIP public article check/);
  assert.match(result.output, /\/api\/jobs: 401/);
});
test("an explicitly selected missing article fails", async () => {
  assert.notEqual((await probe({ articles: ["new-article"], selected: "removed-article" })).code, 0);
});
test("missing showcase cannot silently pass when the sitemap has public articles", async () => {
  const result = await probe({ articles: ["new-article"], showcase: [] });
  assert.notEqual(result.code, 0);
  assert.match(result.output, /landing showcase is missing/);
});
