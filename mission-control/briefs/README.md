# Briefs pipeline (WEB-123)

Mission Control reads `mission-control/data/briefs.json`.

The generator does not create a second reporting system. It reuses the existing
WEB-138 outputs:

- Board Reports project: Morning Standup + End-of-Day Report issues
- Daily Logs project: Morning Intelligence Brief + Day Close comments

## Commands

```bash
npm run briefs:build              # rebuild all brief types into data/briefs.json
npm run briefs:build -- --type morning
npm run briefs:deliver morning    # send/render latest generated Morning Brief
npm run briefs:verify -- morning  # verify latest generated Morning Brief in production
```

`briefs:build` uses the authenticated `multica` CLI on Hermes and writes the
single JSON shape the MC page, email renderer, and Telegram renderer all share:

```json
{
  "id": "morning-2026-07-20",
  "type": "morning",
  "period_label": "Mon, 20 Jul",
  "generated_at": "2026-07-19T18:09:34Z",
  "wins": ["..."],
  "next3": ["...", "...", "..."],
  "industry_pulse": ["..."]
}
```

## Delivery env

No secrets in the repo. Set these on Hermes only:

```bash
BRIEF_DELIVERY_STATE=/srv/webuild/briefs/delivered.json
EMAIL_OUTBOX_DIR=/srv/webuild/briefs/email-outbox
SENDMAIL_BIN=/usr/sbin/sendmail
BRIEF_EMAIL_TO=johan@example.com
BRIEF_EMAIL_FROM=mission-control@example.com
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Email delivery works in two modes:

- `EMAIL_OUTBOX_DIR` writes the rendered HTML email with the server-generated PNG chart.
- `SENDMAIL_BIN` + `BRIEF_EMAIL_TO` + `BRIEF_EMAIL_FROM` sends it through the local mailer.

Telegram delivery posts a text digest when `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_CHAT_ID` are set. If a channel is not configured, the runner skips it
without failing the build.

## Production verification

Mission Control stays password-gated. Scheduled jobs verify the deployed
`briefs.json` asset with a scoped Worker secret instead of board credentials:

```bash
MC_VERIFY_TOKEN="$(node -e 'console.log(crypto.randomUUID()+crypto.randomUUID())')"
printf '%s' "$MC_VERIFY_TOKEN" | npx wrangler secret put MC_VERIFY_TOKEN
npx wrangler deploy --keep-vars
MC_VERIFY_TOKEN="$MC_VERIFY_TOKEN" npm run briefs:verify -- eod
unset MC_VERIFY_TOKEN
```

The token header unlocks only `/mission-control/data/briefs.json`. The UI route
continues to return the sign-in page unless `MC_PASSWORD` is also configured in
the runtime for an authenticated shell check.

## Live schedule (Australia/Sydney)

WEB-328 is wired live through Multica run-only autopilots assigned to the CTO
agent. Each run checks out this repo, updates from `main`, runs tests, builds
the matching brief, commits/pushes `mission-control/data/briefs.json` when it
changes, renders configured delivery channels, deploys the Worker with
`npx wrangler deploy --keep-vars`, then verifies the production JSON and Briefs
page.

| Cadence | Autopilot ID | Cron | Command |
| --- | --- | --- | --- |
| Morning | `c579224e-9dea-4c7e-9b02-ec10142fe474` | `5 8 * * *` | `GIT_PUSH=1 npm run briefs:build -- --type morning && npm run briefs:deliver morning && npx wrangler deploy --keep-vars` |
| End of day | `19b4507b-580c-43d0-b509-5829520118fb` | `35 21 * * *` | `GIT_PUSH=1 npm run briefs:build -- --type eod && npm run briefs:deliver eod && npx wrangler deploy --keep-vars` |
| Weekly | `407a9e0d-80e7-42f5-85d8-e71b4717a026` | `10 7 * * 1` | `BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type weekly && npm run briefs:deliver weekly && npx wrangler deploy --keep-vars` |
| Monthly | `9edff78c-2332-4dbd-abdb-3b3894c18a72` | `15 7 1 * *` | `BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type monthly && npm run briefs:deliver monthly && npx wrangler deploy --keep-vars` |
| Quarterly | `249ba4d9-0062-49ac-9140-58557979a607` | `20 7 1 1,4,7,10 *` | `BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type quarterly && npm run briefs:deliver quarterly && npx wrangler deploy --keep-vars` |
| Yearly | `dfbdae9d-d912-4729-ba51-ce2e8d5318ee` | `25 7 1 1 *` | `BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type yearly && npm run briefs:deliver yearly && npx wrangler deploy --keep-vars` |

## Hermes cron fallback

Use `CRON_TZ=Australia/Sydney` so the cadence follows Johan's operating day.

```cron
CRON_TZ=Australia/Sydney

# Daily reports
5 8 * * * cd /srv/webuild/Webuildco_v1 && git pull --ff-only origin main && npm test && GIT_PUSH=1 npm run briefs:build -- --type morning && npm run briefs:deliver morning && npx wrangler deploy --keep-vars >> /var/log/webuild-briefs.log 2>&1
35 21 * * * cd /srv/webuild/Webuildco_v1 && git pull --ff-only origin main && npm test && GIT_PUSH=1 npm run briefs:build -- --type eod && npm run briefs:deliver eod && npx wrangler deploy --keep-vars >> /var/log/webuild-briefs.log 2>&1

# Longer cadence reports, same pipeline
10 7 * * 1 cd /srv/webuild/Webuildco_v1 && git pull --ff-only origin main && npm test && BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type weekly && npm run briefs:deliver weekly && npx wrangler deploy --keep-vars >> /var/log/webuild-briefs.log 2>&1
15 7 1 * * cd /srv/webuild/Webuildco_v1 && git pull --ff-only origin main && npm test && BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type monthly && npm run briefs:deliver monthly && npx wrangler deploy --keep-vars >> /var/log/webuild-briefs.log 2>&1
20 7 1 1,4,7,10 * cd /srv/webuild/Webuildco_v1 && git pull --ff-only origin main && npm test && BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type quarterly && npm run briefs:deliver quarterly && npx wrangler deploy --keep-vars >> /var/log/webuild-briefs.log 2>&1
25 7 1 1 * cd /srv/webuild/Webuildco_v1 && git pull --ff-only origin main && npm test && BRIEF_PERIOD=previous GIT_PUSH=1 npm run briefs:build -- --type yearly && npm run briefs:deliver yearly && npx wrangler deploy --keep-vars >> /var/log/webuild-briefs.log 2>&1
```
