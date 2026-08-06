# Receipt / invoice intake pipeline (WEB-120)

Feeds Mission Control → Finance. Every channel lands a receipt file in one
`inbox/`; a single processor extracts the fields, validates + fixes the GST
split, appends the expense to `board.json`, and pushes so Cloudflare Pages goes
live. Runs on Hermes.

```
Telegram photo ─┐
                ├─▶  INBOX_DIR ──▶ process-inbox.mjs ──▶ board.json (git push → live)
Watch-folder  ──┘                     │
                                      └─▶ RECEIPTS_DIR   (source files, ATO retention, NEVER committed)
```

## Files
| file | role |
|---|---|
| `log-expense.mjs` | **core** — validate + GST logic + append to `board.json`, bump `last_logged`. Pure, tested. |
| `extract.mjs` | receipt image/PDF → expense fields via Claude vision. |
| `process-inbox.mjs` | cron runner: for each inbox file → extract → log → move source off-repo → commit + push. |
| `telegram-drop.mjs` | Telegram source: downloads receipt photos/PDFs into the inbox. |
| `log-expense.test.mjs` | money-path self-check (`node …/log-expense.test.mjs`). |

## The expense object (contract — all channels emit this)
```json
{ "date":"YYYY-MM-DD", "supplier":"", "desc":"", "amount":0.00,
  "gst":0.00, "cat":"", "via":"Email|Hermes|Manual|Watch-folder", "receipt_url":"" }
```
`amount` = GST-inclusive AUD total. `gst` = GST component: an AU tax invoice is
1/11 of the total; overseas / GST-free suppliers are `0` (extractor sets
`taxable:false`). `receipt_url` points at the retained source **outside the
repo** — the raw receipt is never committed.

## Env (Hermes — keys never in the repo)
```
ANTHROPIC_API_KEY=...            # extraction (required)
ANTHROPIC_MODEL=claude-opus-4-8  # optional override
INBOX_DIR=/srv/webuild/receipts/inbox
RECEIPTS_DIR=/srv/webuild/receipts/archive   # off-repo retention
RECEIPT_BASE=/srv/webuild/receipts/archive   # what receipt_url is prefixed with
GIT_PUSH=1                       # actually push (unset = dry run, log only)
TELEGRAM_BOT_TOKEN=...           # telegram channel
TELEGRAM_ALLOW_CHAT_ID=...       # only this chat may log expenses
```
Keep `INBOX_DIR` / `RECEIPTS_DIR` outside this git worktree so receipt binaries
are never staged. If you must place them inside, `.gitignore` already excludes
`mission-control/intake/inbox/` and `mission-control/intake/archive/`.

## Run on Hermes
Watch-folder + cron (every 15 min), from the repo root:
```cron
*/15 * * * * cd /srv/webuild/Webuildco_v1 && GIT_PUSH=1 \
  INBOX_DIR=/srv/webuild/receipts/inbox RECEIPTS_DIR=/srv/webuild/receipts/archive \
  RECEIPT_BASE=/srv/webuild/receipts/archive ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  node mission-control/intake/process-inbox.mjs >> /var/log/webuild-intake.log 2>&1
```
Telegram poller as a long-running systemd service (drops files into the same
`INBOX_DIR`):
```ini
[Service]
WorkingDirectory=/srv/webuild/Webuildco_v1
EnvironmentFile=/srv/webuild/intake.env
ExecStart=/usr/bin/node mission-control/intake/telegram-drop.mjs
Restart=always
```
Point the watch-folder sync (or a synced Drive/Dropbox folder) at `INBOX_DIR`
for the paper-receipt / PDF-drop channel — the same cron processes it.

**Email-forward** (fallback, per CEO): once Johan sets up the watched inbox,
have Hermes save each attachment into `INBOX_DIR` — no code change, same path.

## First real receipt
The two rows under `finance.expenses[]` in `board.json` are SAMPLES. On the
first real receipt processed, delete those two seed rows in the same commit so
the Finance table shows only real expenses.
