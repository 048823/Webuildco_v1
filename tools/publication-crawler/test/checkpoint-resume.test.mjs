import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

test('crawler resumes without re-fetching a completed checkpoint after SIGTERM', async () => {
  const hits = new Map();
  const server = http.createServer((request, response) => {
    hits.set(request.url, (hits.get(request.url) ?? 0) + 1);
    response.writeHead(request.url === '/robots.txt' ? 404 : 200, { 'content-type': 'text/html' });
    response.end('<html><body><p>No target address here.</p></body></html>');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'web442-resume-'));
  const input = path.join(tempDir, 'input.csv');
  const checkpointDir = path.join(tempDir, 'checkpoints');
  await writeFile(input, `domain,start_url,company_name\n127.0.0.1,http://127.0.0.1:${port}/fixture,Fixture Co\n`, 'utf8');

  try {
    const first = spawn(process.execPath, [
      'tools/publication-crawler/crawl.mjs',
      '--input', input,
      '--output', path.join(tempDir, 'published.csv'),
      '--dropped-output', path.join(tempDir, 'dropped.csv'),
      '--summary-output', path.join(tempDir, 'summary-first.json'),
      '--manifest', path.join(tempDir, 'manifest.jsonl'),
      '--checkpoint-dir', checkpointDir,
      '--concurrency', '1',
      '--delay-domain-ms', '5000',
    ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });

    await waitFor(async () => {
      const body = JSON.parse(await readFile(path.join(checkpointDir, '127.0.0.1.json'), 'utf8'));
      return body.domain === '127.0.0.1';
    });
    first.kill('SIGTERM');
    await new Promise((resolve) => first.once('exit', resolve));

    const beforeResumeHits = hits.get('/fixture');
    assert.equal(beforeResumeHits, 1);

    const second = await runNode([
      'tools/publication-crawler/crawl.mjs',
      '--input', input,
      '--output', path.join(tempDir, 'published.csv'),
      '--dropped-output', path.join(tempDir, 'dropped.csv'),
      '--summary-output', path.join(tempDir, 'summary-second.json'),
      '--manifest', path.join(tempDir, 'manifest.jsonl'),
      '--checkpoint-dir', checkpointDir,
      '--concurrency', '1',
    ]);

    assert.equal(second.code, 0, second.stderr);
    const summary = JSON.parse(await readFile(path.join(tempDir, 'summary-second.json'), 'utf8'));
    assert.equal(summary.skipped_completed, 1);
    assert.equal(hits.get('/fixture'), beforeResumeHits);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

async function waitFor(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch {
      // Poll until the checkpoint file exists and is complete.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for checkpoint');
}
