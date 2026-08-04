# Stack Comparison

Date checked: 2026-08-03

## Recommendation

Use **Twilio Australian local number + Twilio Media Streams + OpenAI Realtime `gpt-realtime-2.1-mini`** for the feasibility demo.

Reason: it proves the real unit economics, gives us an Australian callable number, keeps the business logic in our code, and avoids renting the core agent workflow from a voice-agent platform before we know whether we have a business.

Fastest alternative if a live demo is needed before engineering polish: **Retell AI or Vapi with a Twilio-imported AU number**. That is faster to configure, but the cost and lock-in profile is worse for an owned WeBuild service.

## Comparison Table

| Stack | Latency and reliability | Australian number | Unit cost shape | Integrations | Data retention | Vendor down behaviour | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Twilio Media Streams + OpenAI Realtime | Low-level but direct. Twilio streams phone audio to our WebSocket; OpenAI Realtime handles speech-to-speech. More engineering, fewer platform layers. | Strong. Twilio AU local inbound numbers are listed at USD 3/mo and USD 0.010/min inbound. | Best margin path: Twilio inbound + Media Streams + OpenAI token cost + SMS/email. No voice-agent platform fee. | Full control. We write booking, callback, SMS, webhook, calendar, CRM logic. | We control app retention. OpenAI API data controls still apply; no raw call recordings by default. | If OpenAI fails, Twilio can route to fallback TwiML/human callback. If Twilio fails, number path fails. | Recommended for feasibility and owned product economics. |
| Twilio Conversation Relay + LLM | Twilio handles STT/TTS/voice relay, reducing bridge complexity. | Strong, same Twilio AU number layer. | Conversation Relay is listed at USD 0.07/min, plus Twilio voice costs and LLM usage. | Twilio-native. App still owns business tools. | Twilio/OpenAI retention plus our app retention. | Twilio is a larger dependency. Can route to Twilio fallback if LLM path fails. | Good fallback if Media Streams bridge is unstable. More expensive. |
| Vapi + imported Twilio number | Very fast to build. Vapi has fallbacks for transcriber/voice providers and eval tooling. | Free Vapi numbers are US-only; international/custom numbers require importing a Twilio number. | Usage-based; model costs pass through; concurrency lines listed at USD 10/line/mo; ZDR is listed as an enterprise add-on. | Strong dashboard/API. Good for rapid demos. | Retention controls vary by plan; enterprise controls cost more. | Vapi has provider fallbacks, but Vapi core outage still affects calls. | Fastest demo path, not the cleanest owned-service path. |
| Retell AI | Fastest platform-style build, with simulation testing and live call monitoring. | Can use Retell telephony or custom telephony; Twilio integration exists. Confirm AU number path in account. | Pay-as-you-go voice agents listed at USD 0.07-0.31/min; detailed pricing shows infra, TTS, LLM, telephony and add-ons. | Strong webhooks/API, dashboard, simulations. | Pay-as-you-go includes transcripts/analytics; custom retention is listed in plan comparison. | Retell built-in fallback system is listed; Retell core outage remains a dependency. | Best no-code/low-code feasibility platform. Higher lock-in. |
| Bland AI | Simple platform economics; listed at USD 0.14/min on Start plan, inbound number included as a startup credit. | Need to verify AU number availability and inbound support in account. | Simple connected-minute pricing; lower surprise risk than token stacks, but more expensive than direct Twilio/OpenAI at SMB volume. | Platform-first. Less useful if WeBuild wants owned workflow code. | Marketing claims stronger data isolation; verify contract terms before client use. | Platform outage affects calls unless number is portable/routed elsewhere. | Consider only if direct stack is too slow and AU number path is confirmed. |
| ElevenAgents / ElevenLabs Conversational AI | Strong voice quality and low-friction agent setup. | Telephony is billed separately; confirm AU number path. | Agent plans include call minutes; additional calls listed at USD 0.08/min, telephony separate. | Good for voice experience, less ideal as the system of record. | Needs plan/legal review for client call data. | Platform outage affects calls; telephony provider may be separable. | Good voice layer, not the best full receptionist stack for this demo. |
| Telnyx / Plivo / Vonage + custom voice stack | Potentially cheaper or more direct carrier options. Plivo markets voice AI with sub-500ms latency and 150+ countries. | AU support exists in different forms but needs account-level verification. | Pricing can be attractive, but hidden work is in integration and support. | Full control if custom-built. | Depends on provider and app design. | Similar to Twilio direct path. | Later negotiation/switch candidate, not first demo path. |

## Switching Path

Keep these pieces provider-neutral:

- Tool contracts: `get_available_slots`, `book_roofing_visit`, `request_callback`, `escalate_to_human`.
- Summary payload: one normalized call record with caller, transcript snippets, outcome, and escalation reason.
- Phone number ownership: buy/port in the client-controlled telephony account where possible.
- Calendar/CRM adapters: wrap provider APIs behind our own small functions.

To switch off Twilio later:

1. Port or forward the number to Telnyx, Plivo, Vonage, or client PBX/SIP.
2. Replace the `/voice` webhook and `/media-stream` transport.
3. Keep the receptionist prompt, tool handlers, summary format, test scenarios, and cost model.

To switch off OpenAI later:

1. Keep the Twilio media bridge.
2. Replace OpenAI Realtime session client with another realtime speech stack or cascaded STT -> LLM -> TTS.
3. Preserve tool names and JSON schemas so the booking/escalation system is unchanged.

## Sources

- Twilio AU Voice pricing: https://www.twilio.com/en-us/voice/pricing/au
- Twilio AU SMS pricing: https://www.twilio.com/en-us/sms/pricing/au
- Twilio Conversation Relay pricing: https://www.twilio.com/en-us/products/conversational-ai/pricing
- Twilio Conversation Relay docs: https://www.twilio.com/docs/voice/conversationrelay
- OpenAI Realtime guide: https://developers.openai.com/api/docs/guides/realtime
- OpenAI Realtime WebSocket guide: https://developers.openai.com/api/docs/guides/realtime-websocket
- OpenAI Realtime pricing: https://developers.openai.com/api/docs/pricing
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
- Vapi pricing: https://vapi.ai/pricing
- Vapi phone calling: https://docs.vapi.ai/phone-calling
- Vapi transcriber fallback: https://docs.vapi.ai/customization/transcriber-fallback-plan
- Vapi recording consent plan: https://docs.vapi.ai/security-and-privacy/recording-consent-plan
- Retell pricing: https://www.retellai.com/pricing
- Retell data retention: https://docs.retellai.com/accounts/data-retention
- Bland pricing: https://www.bland.ai/pricing
- Bland billing docs: https://docs.bland.ai/platform/billing
- ElevenAgents pricing: https://elevenlabs.io/pricing/agents
- ElevenAgents docs: https://elevenlabs.io/docs/eleven-agents/overview
- Telnyx Voice API pricing: https://telnyx.com/pricing/voice-api
- Plivo Voice AI: https://www.plivo.com/
- Vonage Voice API pricing: https://www.vonage.com/communications-apis/voice/pricing/
