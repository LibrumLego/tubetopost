import test from "node:test";
import assert from "node:assert/strict";
import { runPoc } from "./poc-supadata.mjs";

test("native requests stay within three calls and reject unusable timestamps", async () => {
  let calls = 0;
  const logs = [];
  const result = await runPoc("private-test-key", async (url, options) => {
    calls++;
    assert.equal(url.searchParams.get("mode"), "native");
    assert.equal(url.searchParams.get("text"), "false");
    assert.equal(options.redirect, "error");
    return Response.json({ content: [{ text: "private transcript", offset: calls === 3 ? -1 : 1000, duration: 500 }] });
  }, (line) => logs.push(line));
  assert.equal(result, 0);
  assert.equal(calls, 3);
  assert.equal(JSON.parse(logs[2]).usable, false);
  assert(!logs.join().includes("private"));
});

test("missing keys make no requests; quota errors stop further spending", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response(null, { status: 429 }); };
  assert.equal(await runPoc(undefined, fetcher, () => {}), 1);
  assert.equal(calls, 0);
  assert.equal(await runPoc("test-key", fetcher, () => {}), 1);
  assert.equal(calls, 1);
});

test("async jobs and malformed responses do not count as successful transcripts", async () => {
  const replies = [new Response(null, { status: 202 }), Response.json({ content: "plain text" }), new Response("broken", { status: 200 })];
  assert.equal(await runPoc("test-key", async () => replies.shift(), () => {}), 1);
  assert.equal(replies.length, 0);
});
