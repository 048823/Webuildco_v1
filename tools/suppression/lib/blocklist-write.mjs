// The one gated call: push suppressed addresses to Instantly's account-level
// blocklist. WEB-497 ruling 3 — written, tested, and OFF.
//
// ─────────────────────────────────────────────────────────────────────────────
// WEB-468: THIS IS THE LINE THAT FLIPS WHEN THE KEY ARRIVES.
//   export const WRITE_ENABLED = false;   →   export const WRITE_ENABLED = true;
// Nothing else changes. The request builder below is already the exact call and
// is covered by fixtures/blocklist-bulk-create.json.
// ─────────────────────────────────────────────────────────────────────────────
//
// The runtime key today is `all:read`. This endpoint needs one of
// block_list_entries:create | block_list_entries:all | all:create | all:all.
import { canonicalEntry } from './address.mjs';

export const WRITE_ENABLED = false;

export const BULK_CREATE_URL = 'https://api.instantly.ai/api/v2/block-lists-entries/bulk-create';

// Body field is `bl_values` (array of strings). The single-entry endpoint
// POST /block-lists-entries takes `bl_value` (singular) — do not mix them up;
// the earlier staged payload on WEB-404 used the singular shape in a bulk body
// and would have 400'd on the first real attempt.
export function buildBulkCreateRequest(values, apiKey) {
  const blValues = [...new Set(values.map((value) => canonicalEntry(value)?.value).filter(Boolean))].sort();
  if (!blValues.length) throw new Error('refusing to build an empty bulk-create request');
  if (!apiKey) throw new Error('refusing to build a bulk-create request with no API key');
  return {
    method: 'POST',
    url: BULK_CREATE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // ponytail: Instantly's edge 403s the default Node/urllib User-Agent.
      'User-Agent': 'curl/8.7.1',
    },
    body: { bl_values: blValues },
  };
}

export async function createBlocklistEntries(values, { apiKey, enabled = WRITE_ENABLED, fetchImpl = fetch } = {}) {
  if (!enabled) {
    throw new Error('blocklist writes are board-gated (WEB-468): set WRITE_ENABLED = true in lib/blocklist-write.mjs once the write-scoped Instantly key is issued');
  }
  const request = buildBulkCreateRequest(values, apiKey);
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${BULK_CREATE_URL} returned ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
