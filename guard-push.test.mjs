// WEB-694: `git push` on an agent branch resolved to refs/heads/main — production — because
// the checkout inherits branch.<name>.merge = refs/heads/main and push.default = upstream.
// Test the shipped hook against the exact stdin git feeds it, not a copy of the logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const HOOK = new URL('./.githooks/pre-push', import.meta.url);
const SHA = '1111111111111111111111111111111111111111';
const ZERO = '0000000000000000000000000000000000000000';

// git calls the hook as: pre-push <remote-name> <remote-url>, one ref per stdin line.
const push = (lines) => spawnSync('sh', [HOOK.pathname, 'origin', 'https://github.com/048823/Webuildco_v1'], {
  input: lines.map((l) => l + '\n').join(''),
  encoding: 'utf8',
});

test('a feature branch pushed at main is refused', () => {
  for (const local of ['refs/heads/agent/cto/8f3b2fe0', 'refs/heads/agent/cdo/proof-grid', 'refs/heads/fix/typo']) {
    const r = push([`${local} ${SHA} refs/heads/main ${ZERO}`]);
    assert.equal(r.status, 1, `${local} -> main should be refused`);
    assert.match(r.stderr, /refusing to push/);
  }
});

test('deleting main is refused too — the local ref is empty, not main', () => {
  assert.equal(push([`(delete) ${ZERO} refs/heads/main ${SHA}`]).status, 1);
});

test('one bad ref in a multi-ref push fails the whole push', () => {
  // git runs the hook once for all refs; a per-ref pass must not clear an earlier refusal.
  const r = push([
    `refs/heads/agent/cto/8f3b2fe0 ${SHA} refs/heads/agent/cto/8f3b2fe0 ${ZERO}`,
    `refs/heads/agent/cto/8f3b2fe0 ${SHA} refs/heads/main ${ZERO}`,
  ]);
  assert.equal(r.status, 1);
});

test('pushing a branch to its own name is allowed', () => {
  const ok = [
    `refs/heads/agent/cto/8f3b2fe0 ${SHA} refs/heads/agent/cto/8f3b2fe0 ${ZERO}`,
    `refs/heads/main ${SHA} refs/heads/main ${ZERO}`,
    `refs/tags/v1 ${SHA} refs/tags/v1 ${ZERO}`,
    `refs/heads/main-2 ${SHA} refs/heads/main-2 ${ZERO}`,
  ];
  for (const line of ok) assert.equal(push([line]).status, 0, `should be allowed: ${line}`);
  assert.equal(push([]).status, 0, 'an empty push must not fail');
});

test('the hook is executable and wired up, or git silently ignores it', () => {
  assert.ok(statSync(HOOK).mode & 0o111, '.githooks/pre-push is not executable — git would skip it');
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
  assert.match(pkg.scripts.prepare || '', /core\.hooksPath/, 'npm install no longer points git at .githooks');
});
