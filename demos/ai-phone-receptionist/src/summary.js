import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { business } from "./business.js";

export function buildSummary(callRecord = {}) {
  const lines = [
    `${business.name} call summary`,
    `Demo only: yes`,
    `Call SID: ${callRecord.callSid || "unknown"}`,
    `From: ${callRecord.from || "unknown"}`,
    `Started: ${callRecord.startedAt || "unknown"}`,
    `Ended: ${callRecord.endedAt || "unknown"}`,
  ];

  if (callRecord.outcomes?.length) {
    lines.push("");
    lines.push("Outcomes:");
    for (const outcome of callRecord.outcomes) {
      lines.push(`- ${outcome.type || outcome.status}: ${outcome.summary || outcome.reason || outcome.id}`);
    }
  }

  if (callRecord.transcript?.length) {
    lines.push("");
    lines.push("Transcript snippets:");
    for (const item of callRecord.transcript.slice(-12)) {
      lines.push(`- ${item.role}: ${item.text}`);
    }
  }

  return lines.join("\n");
}

export async function persistCallRecord(callRecord, rootDir = "var/calls") {
  await mkdir(rootDir, { recursive: true });
  const safeId = String(callRecord.callSid || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = join(rootDir, `${safeId}.json`);
  await writeFile(path, `${JSON.stringify(callRecord, null, 2)}\n`, "utf8");
  return path;
}

export async function deliverSummary(callRecord) {
  const summary = buildSummary(callRecord);
  const results = [];

  results.push(await sendWebhookSummary(summary, callRecord));
  results.push(await sendSmsSummary(summary));

  return results;
}

async function sendWebhookSummary(summary, callRecord) {
  if (!process.env.SUMMARY_WEBHOOK_URL) {
    return { channel: "webhook", status: "skipped", reason: "SUMMARY_WEBHOOK_URL not set" };
  }

  const response = await fetch(process.env.SUMMARY_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      business: business.name,
      demo: true,
      summary,
      callRecord,
    }),
  });

  return {
    channel: "webhook",
    status: response.ok ? "sent" : "failed",
    httpStatus: response.status,
  };
}

async function sendSmsSummary(summary) {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    SUMMARY_SMS_FROM,
    SUMMARY_SMS_TO,
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !SUMMARY_SMS_FROM || !SUMMARY_SMS_TO) {
    return { channel: "sms", status: "skipped", reason: "Twilio SMS env vars not set" };
  }

  const body = new URLSearchParams({
    From: SUMMARY_SMS_FROM,
    To: SUMMARY_SMS_TO,
    Body: summary.slice(0, 1500),
  });

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  return {
    channel: "sms",
    status: response.ok ? "sent" : "failed",
    httpStatus: response.status,
  };
}
