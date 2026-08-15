# AI Phone Receptionist Demo

This is a deliberately narrow feasibility demo for `WEB-430`: one invented Australian trade business, one inbound call flow, no dashboard, no multi-tenant code, no CRM platform.

Demo business: `Harbourview Roofing Demo Co`

Status from this run:

- The runnable scaffold, stack comparison, scenario harness, and cost model are included here.
- A live callable number was not provisioned because the runtime had no Twilio, OpenAI, Vapi, Retell, or SMS/email provider credentials in environment variables or matching 1Password item titles.
- The demo can become callable after secrets are added and an Australian Twilio number is pointed at `/voice`.

## Flow

The receptionist covers only this v1 path:

`greeting -> intent -> qualification -> booking or callback -> human escalation -> SMS/webhook summary`

Guardrails:

- The first spoken turn discloses that this is an AI receptionist and a demo business.
- The agent must not pretend to be human.
- No medical, legal, emergency, or financial advice.
- Emergency/safety callers are told to contact emergency services or SES first, then a callback is logged.
- Human escalation is always available.
- Call recording is off by default. If enabled, the opening disclosure must ask for recording consent.

## Run Locally

```bash
cd demos/ai-phone-receptionist
npm install
cp .env.example .env
npm start
```

Expose the local server with a TLS tunnel:

```bash
ngrok http 8787
```

Set `PUBLIC_BASE_URL` to the tunnel URL, then configure an Australian Twilio number:

- Voice webhook: `https://YOUR_HOST/voice`
- Method: `POST`
- Recording: disabled for the demo unless consent wording and retention policy are enabled.

Health check:

```bash
curl http://localhost:8787/health
```

## Required Secrets

Keep these in a secret store or runtime environment. Do not commit them.

- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SUMMARY_SMS_FROM`
- `SUMMARY_SMS_TO`
- Optional: `SUMMARY_WEBHOOK_URL`
- Optional: `HUMAN_TRANSFER_NUMBER`

## Test Harness

The included tests are deterministic flow tests, not live audio tests:

```bash
npm test
npm run costs
```

They exercise 30 scripted scenarios against the booking/escalation rules. The voice-specific acceptance tests still require the live number and must be run by phone once credentials exist.

## Documents

- `docs/stack-comparison.md`
- `docs/unit-cost-model.md`
- `docs/test-evidence.md`
- `docs/operations-estimate.md`
