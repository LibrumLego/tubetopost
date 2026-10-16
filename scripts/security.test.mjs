import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonObject, sameOriginMutation } from '../src/lib/security/request.ts';
import { renderMarkdown } from '../src/lib/markdown.ts';
import { parseYouTubeUrl } from '../src/lib/youtube/url.ts';
import { safeAuthRedirect } from '../src/lib/auth-redirect.ts';

const json = (body, extra = {}) => new Request('https://example.test/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body });
test('same-origin mutations reject foreign, null, missing and cross-site origins', () => {
  for (const origin of [undefined, 'null', 'https://evil.test', 'https://example.test.evil.test']) {
    assert.equal(sameOriginMutation(json('{}', origin ? { origin } : {})), false);
  }
  assert.equal(sameOriginMutation(json('{}', { origin: 'https://example.test' })), true);
  assert.equal(sameOriginMutation(json('{}', { origin: 'https://example.test', 'sec-fetch-site': 'cross-site' })), false);
});
test('streamed byte limits work without Content-Length and cancel excess data', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"x":"' + '가'.repeat(40))); }, cancel() { cancelled = true; } });
  const request = new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' });
  await assert.rejects(readJsonObject(request, 100), e => e.status === 413);
  assert.equal(cancelled, true);
});
test('JSON reader rejects wrong types and oversized declared bodies', async () => {
  await assert.rejects(readJsonObject(json('{}', { 'content-length': '1000' }), 100), e => e.status === 413);
  for (const body of ['[]', 'null', '1', '"text"', '{broken']) await assert.rejects(readJsonObject(json(body), 100), e => e.status === 400);
  await assert.rejects(readJsonObject(new Request('https://example.test', { method: 'POST', body: '{}' }), 100), e => e.status === 415);
  assert.deepEqual(await readJsonObject(json('{"valid":true}'), 100), { valid: true });
});
test('public Markdown rendering removes stored scripts, handlers, forms and unsafe links', () => {
  const html = renderMarkdown('<script>stealCookie()</script><svg onload=alert(1)><a href="javascript:alert(1)">bad</a></svg>\n<img src=x onerror=alert(1)><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input></form>\n[unsafe](javascript:alert(1))\n[good](https://example.test)\n## Heading');
  for (const bad of ['<script', 'onerror', 'onload', 'javascript:', '<iframe', '<form', '<svg', '<img']) assert.equal(html.includes(bad), false, bad);
  assert.ok(html.includes('<h2>Heading</h2>'));
  assert.ok(html.includes('href="https://example.test"'));
});
test('SSRF URLs and auth open redirects remain rejected', () => {
  for (const url of ['http://127.0.0.1/watch?v=arj7oStGLkU', 'https://www.youtube.com.evil.test/watch?v=arj7oStGLkU', 'https://user:pass@www.youtube.com/watch?v=arj7oStGLkU', 'file:///etc/passwd', 'https://www.youtube.com:8080/watch?v=arj7oStGLkU']) assert.equal(parseYouTubeUrl(url), null);
  for (const next of ['//evil.test', '/\\evil.test', 'https://evil.test', '/\n/evil.test']) assert.equal(safeAuthRedirect(next, 'https://example.test').origin, 'https://example.test');
});
