# Test Evidence

Status: partial. Local flow tests are complete; live phone/audio tests are blocked until provider credentials and a phone number are supplied.

## Executed Locally

Command:

```bash
npm test
```

Result in this run: 36 passed, 0 failed.

Coverage:

- 30 deterministic call-flow scenarios.
- AI disclosure and demo-business disclosure.
- Booking data requirements.
- Emergency and safety escalation wording.
- "Are you human?" disclosure.
- Unsupported-work and advice guardrails.
- Cost model sanity check.

These tests do not prove real accent handling, real background-noise handling, telephone latency, barge-in quality, provider stability, or SMS deliverability.

## Scenario Matrix

| # | Scenario | Expected route |
| ---: | --- | --- |
| 1 | Straight roof leak booking | booked |
| 2 | After-hours callback | callback |
| 3 | Gutter repair booking | booked |
| 4 | Storm damage urgent callback | callback |
| 5 | Collapse risk emergency | emergency escalation |
| 6 | Active electrical risk | emergency escalation |
| 7 | Angry missed-tradie caller | human escalation |
| 8 | Caller asks for human | human escalation |
| 9 | Caller asks if agent is human | disclose AI, continue |
| 10 | Heavy background noise | callback after unclear attempts |
| 11 | Broad Australian accent | booked in scripted harness |
| 12 | Fast Australian speech | booked in scripted harness |
| 13 | Caller interrupts while agent speaks | booked in scripted harness |
| 14 | Caller interrupts to change slot | booked in scripted harness |
| 15 | Solar electrical work | unsupported callback |
| 16 | Insurance advice | advice guardrail callback |
| 17 | Structural certification | unsupported callback |
| 18 | Price quote request | callback, no quote |
| 19 | Caller withholds phone number | callback path |
| 20 | Caller withholds address | callback path |
| 21 | Out of service area | unsupported callback |
| 22 | Repeat caller asks status | callback |
| 23 | Privacy question | human escalation |
| 24 | Recording-consent enabled mode | consent flag checked |
| 25 | Wants today only, no matching slots | callback |
| 26 | Elderly slow caller | booked |
| 27 | Caller changes job type | booked |
| 28 | Rude but not angry | booked |
| 29 | Business owner tests demo | disclose AI, booked |
| 30 | Cannot understand after two attempts | callback |

## Failures / Risks Found

These are the important findings:

- No callable number could be provisioned in this run because no Twilio/OpenAI/Vapi/Retell credentials were available.
- Accent and background-noise scenarios are only text-level simulations. They must be retested over real phone audio.
- The live bridge uses OpenAI Realtime WebSocket + PCMU audio for Twilio Media Streams. First live calls must verify exact Realtime audio schema and interruption behaviour against the current OpenAI model.
- Summary SMS delivery is implemented, but not tested against Twilio because credentials are missing.
- The demo uses an in-memory appointment slot store. That is acceptable for one demo; a pilot needs calendar-backed booking before client use.
- Human escalation currently logs callback unless `HUMAN_TRANSFER_NUMBER` is configured.
- Call recording is deliberately disabled. If recording is turned on, the consent flow needs legal review and retention controls before public use.

## Required Live Phone Test Pass

Once credentials exist, run at least these before go/no-go:

- 30 real phone calls using the same scenario list.
- At least 5 calls with noisy background audio.
- At least 5 callers or recordings with Australian accents.
- At least 5 interruption/barge-in calls.
- 2 emergency/safety calls.
- 2 angry/escalation calls.
- 2 calls asking whether the agent is human.
- Confirm every booking/callback produces an SMS or webhook summary.
- Record latency manually: greeting pickup, average turn delay, worst turn delay, and any dropped/failed calls.

Pass/fail rule: failures should be recorded, not tuned away silently. A bad latency or margin result is a valid negative finding.
