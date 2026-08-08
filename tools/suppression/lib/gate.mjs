// The pre-send gate. WEB-497 ruling 2: same-run suppression, fail closed.
//
// This module deliberately reads no environment variable and exposes no
// override. There is no supported way to send past it — an unreadable, stale,
// malformed or empty store raises, it never degrades to "nothing suppressed".
// verify-production.mjs asserts that property mechanically; if you add a
// process.env read here, the repo test suite fails.
import { readFileSync } from 'node:fs';
import { canonicalAddress, canonicalEntry } from './address.mjs';

// A store older than this is refused. Same-run suppression is the target, so a
// send that has not reconciled against the API today does not go out.
export const MAX_STORE_AGE_HOURS = 24;

class Refusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'SuppressionRefusal';
  }
}

export function storeFromEntries(entries, generatedAt) {
  if (!Array.isArray(entries)) throw new Refusal('suppression store has no entries array — nothing may send');
  const addresses = new Set();
  const domains = new Set();
  const rejected = [];
  for (const raw of entries) {
    const entry = canonicalEntry(raw);
    if (!entry) rejected.push(raw);
    else if (entry.kind === 'address') addresses.add(entry.value);
    else domains.add(entry.value);
  }
  // An unparseable entry is a person we cannot prove we are suppressing.
  if (rejected.length) {
    throw new Refusal(`suppression store has ${rejected.length} unparseable entr${rejected.length === 1 ? 'y' : 'ies'} — nothing may send`);
  }
  return {
    generatedAt,
    size: addresses.size + domains.size,
    isSuppressed(value) {
      const address = canonicalAddress(value);
      if (!address) return true; // unparseable candidate: refuse rather than guess
      return addresses.has(address) || domains.has(address.slice(address.indexOf('@') + 1));
    },
  };
}

export function loadStore(path, { now = new Date(), maxAgeHours = MAX_STORE_AGE_HOURS } = {}) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Refusal(`suppression store unreadable at ${path} (${err.code || err.message}) — nothing may send`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Refusal(`suppression store at ${path} is not JSON (${err.message}) — nothing may send`);
  }

  const generatedAt = Date.parse(data?.generated_at);
  if (!Number.isFinite(generatedAt)) {
    throw new Refusal(`suppression store at ${path} has no usable generated_at — nothing may send`);
  }
  const ageHours = (now.getTime() - generatedAt) / 3_600_000;
  if (ageHours > maxAgeHours) {
    throw new Refusal(`suppression store at ${path} is ${ageHours.toFixed(1)}h old (limit ${maxAgeHours}h) — reconcile against GET /api/v2/emails before sending`);
  }

  return storeFromEntries(data.entries, new Date(generatedAt).toISOString());
}

// The gate itself. Throws on the first suppressed address; returns the checked
// count so a caller cannot mistake "did nothing" for "passed".
export function assertSendable(candidates, store) {
  if (!store || typeof store.isSuppressed !== 'function') {
    throw new Refusal('no suppression store supplied — nothing may send');
  }
  const list = [...candidates];
  const blocked = list.filter((candidate) => store.isSuppressed(candidate));
  if (blocked.length) {
    throw new Refusal(`${blocked.length} suppressed address(es) in the send list — nothing may send: ${blocked.slice(0, 5).join(', ')}${blocked.length > 5 ? ', …' : ''}`);
  }
  return list.length;
}
