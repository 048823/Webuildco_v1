import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalAddress, canonicalEntry } from '../lib/address.mjs';
import { MAX_STORE_AGE_HOURS, assertSendable, loadStore, storeFromEntries } from '../lib/gate.mjs';
import { BULK_CREATE_URL, WRITE_ENABLED, buildBulkCreateRequest, createBlocklistEntries } from '../lib/blocklist-write.mjs';
import fixture from '../fixtures/blocklist-bulk-create.json' with { type: 'json' };

const FRESH = () => ({ generated_at: new Date().toISOString(), entries: ['Jane.Doe@Example.com.au', 'blocked-domain.com'] });
const tmp = (name, body) => {
  const path = join(mkdtempSync(join(tmpdir(), 'suppression-')), name);
  writeFileSync(path, body);
  return path;
};

test('canonical form collapses case, plus-addressing, and mailto/angle wrapping', () => {
  const want = 'jane.doe@example.com.au';
  for (const variant of ['Jane.Doe@Example.com.AU', 'jane.doe+newsletter@example.com.au', '<JANE.DOE@example.com.au>', 'mailto:jane.doe+b2@example.com.au']) {
    assert.equal(canonicalAddress(variant), want, variant);
  }
  assert.equal(canonicalAddress('not-an-address'), '');
  assert.deepEqual(canonicalEntry('Blocked-Domain.COM'), { kind: 'domain', value: 'blocked-domain.com' });
});

// The definition-of-done check: a suppressed address must not pass the gate,
// in any form it could plausibly arrive in.
test('gate blocks a suppressed address in every equivalent form', () => {
  const store = storeFromEntries(FRESH().entries, new Date().toISOString());
  for (const variant of ['jane.doe@example.com.au', 'JANE.DOE@EXAMPLE.COM.AU', 'jane.doe+b2@example.com.au', ' <Jane.Doe@Example.com.au> ']) {
    assert.throws(() => assertSendable([variant], store), /suppressed address/, variant);
  }
  // Domain entries are account-wide too: anyone at a blocked domain is blocked.
  assert.throws(() => assertSendable(['someone.else@blocked-domain.com'], store), /suppressed address/);
  assert.equal(assertSendable(['fresh.lead@other.com.au'], store), 1);
});

test('gate fails closed on an unreachable, malformed, undated, or stale store', () => {
  assert.throws(() => loadStore('/nonexistent/suppression-list.json'), /nothing may send/);
  assert.throws(() => loadStore(tmp('s.json', 'not json')), /nothing may send/);
  assert.throws(() => loadStore(tmp('s.json', JSON.stringify({ entries: [] }))), /generated_at/);
  assert.throws(() => loadStore(tmp('s.json', JSON.stringify({ generated_at: new Date().toISOString() }))), /entries array/);
  assert.throws(() => loadStore(tmp('s.json', JSON.stringify({ generated_at: new Date().toISOString(), entries: ['@@@'] }))), /unparseable/);

  const stale = { ...FRESH(), generated_at: new Date(Date.now() - (MAX_STORE_AGE_HOURS + 1) * 3_600_000).toISOString() };
  assert.throws(() => loadStore(tmp('s.json', JSON.stringify(stale))), /reconcile against GET \/api\/v2\/emails/);

  // A store with zero suppression entries still loads — 0 opt-outs is a real,
  // verified state — but an unparseable candidate is refused, not waved through.
  const empty = loadStore(tmp('s.json', JSON.stringify({ generated_at: new Date().toISOString(), entries: [] })));
  assert.equal(empty.size, 0);
  assert.throws(() => assertSendable(['garbage'], empty), /suppressed address/);
  assert.throws(() => assertSendable(['a@b.com'], null), /nothing may send/);
});

test('a fresh store on disk loads and gates', () => {
  const store = loadStore(tmp('suppression-list.json', JSON.stringify(FRESH())));
  assert.equal(store.size, 2);
  assert.throws(() => assertSendable(['jane.doe+x@example.com.au'], store), /suppressed address/);
});

// WEB-605: the durability check. The domains the reconcile unions into every
// rebuild are repo-tracked, so this test — not a file on one machine — is what
// fails if a suppressed domain goes missing.
test('the repo-tracked domain blocklist still suppresses everyone at its domains', () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'domain-blocklist.txt');
  const domains = readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.split('#')[0].trim().toLowerCase())
    .filter(Boolean);

  const store = storeFromEntries(domains, new Date().toISOString());
  assert.equal(store.size, domains.length, 'every line must parse as a domain — a dropped line is a firm we stopped suppressing');
  for (const domain of domains) {
    assert.throws(() => assertSendable([`anyone@${domain}`], store), /suppressed address/, domain);
  }

  // The named regression: Selina opted out, her colleague is in the QUARANTINE
  // lead set, and this line is the only thing that refuses him (WEB-603).
  assert.ok(domains.includes('vanuatuadvance.com'), 'WEB-605: vanuatuadvance.com must stay suppressed');
  for (const variant of ['dean@vanuatuadvance.com', 'Dean@VanuatuAdvance.com', 'dean+leads@vanuatuadvance.com']) {
    assert.throws(() => assertSendable([variant], store), /suppressed address/, variant);
  }
  assert.equal(assertSendable(['fresh.lead@example.com.au'], store), 1);
});

test('bulk-create request matches the recorded fixture', () => {
  const request = buildBulkCreateRequest(['Blocked.User@Example.com', 'blocked.user+tag@example.com', 'Example.com'], 'test-key');
  assert.equal(request.method, fixture.request.method);
  assert.equal(request.url, fixture.request.url);
  assert.equal(request.url, BULK_CREATE_URL);
  assert.deepEqual(request.body, fixture.request.body); // dedup + canonicalised + sorted
  assert.equal(request.headers.Authorization, 'Bearer test-key');
  assert.throws(() => buildBulkCreateRequest([], 'test-key'), /empty bulk-create/);
  assert.throws(() => buildBulkCreateRequest(['a@b.com'], ''), /no API key/);
});

test('the write stays off and refuses without ever touching the network', async () => {
  assert.equal(WRITE_ENABLED, false, 'WEB-468: the blocklist write must ship disabled');
  const boom = () => assert.fail('createBlocklistEntries called fetch while the write flag was off');
  await assert.rejects(() => createBlocklistEntries(['a@b.com'], { apiKey: 'k', fetchImpl: boom }), /board-gated \(WEB-468\)/);

  // With the flag on it makes exactly one call and parses the recorded response.
  let seen;
  const result = await createBlocklistEntries(['blocked.user@example.com', 'example.com'], {
    apiKey: 'k',
    enabled: true,
    fetchImpl: (url, init) => {
      seen = { url, init };
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(fixture.response)) });
    },
  });
  assert.equal(seen.url, BULK_CREATE_URL);
  assert.deepEqual(JSON.parse(seen.init.body), fixture.request.body);
  assert.deepEqual(result, fixture.response);
});
