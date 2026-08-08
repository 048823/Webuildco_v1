// WEB-515: the branch guard is the only thing standing between a feature-branch
// push and a production deploy. Test the exact shipped command string, not a copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const GUARD = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).scripts['guard:branch'];

// Run the guard with a clean env so the ambient shell can't leak WORKERS_CI_* in.
const run = (env) => spawnSync('sh', ['-c', GUARD], { env: { PATH: process.env.PATH, ...env } }).status;

test('outside Workers Builds the guard is a no-op', () => {
  assert.equal(run({}), 0, 'local builds must not be blocked');
  assert.equal(run({ WORKERS_CI_BRANCH: 'agent/cto/whatever' }), 0);
});

test('inside Workers Builds only main may build', () => {
  assert.equal(run({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }), 0);
});

test('inside Workers Builds every non-main branch fails before deploy', () => {
  for (const branch of ['agent/cto/8503987e', 'agent/cdo/proof-grid', 'Main', 'main-2', '']) {
    assert.equal(run({ WORKERS_CI: '1', WORKERS_CI_BRANCH: branch }), 1, `branch "${branch}" should be refused`);
  }
});

test('the guard reads WORKERS_CI_BRANCH, not the Pages variable', () => {
  // CF_PAGES_BRANCH is Pages-only; on Workers Builds it is never set, so keying
  // off it would silently never match and the guard would be decorative.
  assert.match(GUARD, /WORKERS_CI_BRANCH/);
  assert.doesNotMatch(GUARD, /CF_PAGES_BRANCH/);
});
