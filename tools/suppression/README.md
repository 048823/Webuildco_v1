# Suppression (WEB-404 / WEB-497)

Account-wide opt-out suppression. A person suppressed here is suppressed across
every campaign, current and future — `stop_on_reply` is campaign-scoped and the
Spam Act is account-scoped, so per-campaign settings are not a control.

## Flow

```
GET /api/v2/emails ───────┐
GET /block-lists-entries ─┤
domain-blocklist.txt ─────┼─ optout-scan.py ─→ runs/suppression/suppression-list.json ─→ check.mjs (gate)
$SUPPRESSION_SEED ────────┘                             │
                                                        └─→ bulk_create_payload ─→ blocklist-write.mjs (OFF)
```

```sh
npm run suppression:reconcile              # rebuild the store from the API
npm run suppression:check -- leads.csv     # exit 0 = clear to send, 1 = do not send
npm run suppression:test
```

## Rules the code enforces

- **Fails closed.** Unreachable, malformed, undated, stale (>24h) store, or an
  unparseable address → raises. There is no "nothing suppressed" default.
- **No off switch.** `lib/gate.mjs` and `lib/address.mjs` read no environment
  variable. `verify-production.mjs` fails the repo test suite if that changes,
  or if a suppressed address passes the gate in any equivalent form.
- **Match is account-wide**: lowercased, plus-tag stripped, and a bare-domain
  entry suppresses every address at that domain.
- **Ground truth is the API**, not our records — the store is rebuilt each run.
- **A rebuild that drops a suppressed domain fails.** `optout-scan.py` re-reads
  the store it just wrote and exits non-zero if any `domain-blocklist.txt` entry
  is missing; `npm run suppression:test` fails if a domain is deleted from the
  file. A store that silently loses entries is worse than none, because we cite it.

## Where each entry lives, and what survives a rebuild (WEB-605)

The store is rebuilt from scratch every run and is gitignored, so nothing in it
is durable on its own. Durability comes from the source an entry is rebuilt
*from*:

| source | holds | durable? |
|---|---|---|
| `GET /emails` opt-out replies | addresses that replied "stop" | yes — re-derived from the API every run |
| `GET /block-lists-entries` | Instantly's own blocklist | yes — lives in Instantly |
| `domain-blocklist.txt` | domains suppressed account-wide | yes — repo-tracked, reviewed, on every machine |
| `$SUPPRESSION_SEED` | addresses suppressed by ruling | **no** — one off-repo file, one machine |

A domain therefore goes in `domain-blocklist.txt`, never only in the seed. A
domain is not personal data, so tracking it costs nothing and buys review,
history, and survival. Addresses stay in the seed because they are.

`$SUPPRESSION_SEED` is optional and unset by default — as of 12-Aug-2026 no
canonical seed file exists, and no machine runs the reconcile on a schedule; it
runs on whatever agent runtime is asked to run it. Anything that must survive a
rebuild goes in the repo file, which is why the seed being absent is not a
breach and a missing `domain-blocklist.txt` is.

## Data handling

The store and the seed hold personal data. This repo is served publicly, so
neither may be committed: `runs/` is in `.gitignore`, and `tools/suppression`
plus `runs` are in `.assetsignore`. Keep `$SUPPRESSION_SEED` outside the repo.
`domain-blocklist.txt` holds domains only — no addresses, and the reconcile
refuses to rebuild if a line is anything but a bare domain.

## The gated write

`lib/blocklist-write.mjs` holds the exact `POST /block-lists-entries/bulk-create`
call, tested against `fixtures/blocklist-bulk-create.json`, and disabled.

**To enable when the write-scoped Instantly key lands (WEB-468):**

```diff
- export const WRITE_ENABLED = false;
+ export const WRITE_ENABLED = true;
```

One line, `tools/suppression/lib/blocklist-write.mjs`. Nothing else changes.
The key needs one of `block_list_entries:create`, `block_list_entries:all`,
`all:create`, `all:all`; today's runtime key is `all:read`.
