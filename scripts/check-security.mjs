// Non-destructive production probes: no session, conversion, email or model call.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin = new URL(process.argv[2] ?? 'https://tubetopost.vercel.app').origin;
const dir = mkdtempSync(join(tmpdir(), 'tubetopost-security-'));
function request(path, args = []) {
  const headerFile = join(dir, 'headers');
  const bodyFile = join(dir, 'body');
  const status = Number(execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-sS', '--max-time', '25', '-D', headerFile, '-o', bodyFile, '-w', '%{http_code}', ...args, origin + path], { encoding: 'utf8' }));
  return { status, headers: readFileSync(headerFile, 'utf8').toLowerCase() };
}
try {
  const page = request('/beta');
  assert.equal(page.status, 200);
  for (const header of ["frame-ancestors 'none'", "script-src-attr 'none'", "object-src 'none'", 'x-frame-options: deny', 'x-content-type-options: nosniff', 'referrer-policy: no-referrer', 'strict-transport-security:']) assert.ok(page.headers.includes(header), header);
  assert.ok(!page.headers.includes('x-powered-by:'));
  console.log('PASS browser security headers');
  assert.equal(request('/api/jobs', ['-X', 'POST', '-H', 'Origin: https://outside.invalid', '-H', 'Content-Type: application/json', '--data-binary', '{}']).status, 403);
  assert.equal(request('/api/jobs', ['-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '{}']).status, 403);
  console.log('PASS cross-site and missing-Origin mutations rejected');
  assert.equal(request('/api/jobs', ['-X', 'POST', '-H', `Origin: ${origin}`, '-H', 'Content-Type: application/json', '--data-binary', 'x'.repeat(8193)]).status, 413);
  console.log('PASS oversized unauthenticated request rejected');
  const jobs = request('/api/jobs');
  assert.equal(jobs.status, 401);
  assert.ok(jobs.headers.includes('no-store'));
  console.log('PASS unauthenticated data access rejected and uncached');
  assert.equal(request('/api/beta/visit', ['-X', 'POST', '-H', `Origin: ${origin}`, '-H', 'Content-Type: application/json', '--data-binary', 'null']).status, 400);
  console.log('PASS invalid public request rejected');
} finally { rmSync(join(dir, 'headers'), { force: true }); rmSync(join(dir, 'body'), { force: true }); rmdirSync(dir); }
