// Deliver generated briefs. Channels are opt-in via env; secrets stay on Hermes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BRIEFS_PATH } from "./build-briefs.mjs";
import { emailSubject, renderEmailHtml, renderTelegramText } from "./renderers.mjs";

const STATE_PATH = process.env.BRIEF_DELIVERY_STATE || "";
const TYPES = new Set(["morning", "eod", "weekly", "monthly", "quarterly", "yearly"]);

function readJson(path, fallback) {
  if (!path || !existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function selectBrief(briefs) {
  const arg = process.argv[2] || "latest";
  const sorted = [...briefs].sort((a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || "")));
  if (TYPES.has(arg)) return sorted.find((b) => b.type === arg);
  return arg === "latest" ? sorted[0] : sorted.find((b) => b.id === arg);
}

function deliverEmail(brief, briefs) {
  if (!process.env.BRIEF_EMAIL_TO && !process.env.EMAIL_OUTBOX_DIR) return false;
  const html = renderEmailHtml(brief, briefs);
  if (process.env.EMAIL_OUTBOX_DIR) {
    mkdirSync(process.env.EMAIL_OUTBOX_DIR, { recursive: true });
    writeFileSync(join(process.env.EMAIL_OUTBOX_DIR, `${brief.id}.html`), html);
  }
  if (process.env.SENDMAIL_BIN && process.env.BRIEF_EMAIL_TO && process.env.BRIEF_EMAIL_FROM) {
    const msg = [
      `To: ${process.env.BRIEF_EMAIL_TO}`,
      `From: ${process.env.BRIEF_EMAIL_FROM}`,
      `Subject: ${emailSubject(brief)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
    ].join("\n");
    execFileSync(process.env.SENDMAIL_BIN, ["-t"], { input: msg });
  }
  return true;
}

async function deliverTelegram(brief) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_ALLOW_CHAT_ID;
  if (!token || !chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: renderTelegramText(brief), disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`telegram send failed: ${res.status} ${await res.text()}`);
  return true;
}

const briefs = readJson(BRIEFS_PATH, []);
const brief = selectBrief(briefs);
if (!brief) {
  console.error(`brief not found: ${process.argv[2] || "latest"}`);
  process.exit(1);
}

const state = readJson(STATE_PATH, {});
const key = brief.id;
if (state[key]?.delivered) {
  console.log(`${key} already delivered via ${state[key].delivered.join(", ")}`);
  process.exit(0);
}

const delivered = [];
if (deliverEmail(brief, briefs)) delivered.push("email");
if (await deliverTelegram(brief)) delivered.push("telegram");

if (delivered.length) {
  state[key] = { delivered, at: new Date().toISOString(), file: basename(BRIEFS_PATH) };
  writeJson(STATE_PATH, state);
  console.log(`${key} delivered via ${delivered.join(", ")}`);
} else {
  console.log(`${key} rendered; no delivery channels configured`);
}
