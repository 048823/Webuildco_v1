// Telegram → inbox source for the receipt pipeline (WEB-120). Long-polls the
// bot; every photo/PDF from the allowlisted chat is downloaded into INBOX_DIR,
// where process-inbox.mjs picks it up. Deliberately does NOT parse or log — one
// job: get the file onto disk. Run as a Hermes systemd service (see README).
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOW_CHAT_ID (only this chat is accepted —
//      a bot token is public-ish, the allowlist is what stops strangers logging
//      expenses), INBOX_DIR. Keys via env only.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOW = String(process.env.TELEGRAM_ALLOW_CHAT_ID || "");
const INBOX = process.env.INBOX_DIR;
if (!TOKEN || !ALLOW || !INBOX) { console.error("set TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOW_CHAT_ID, INBOX_DIR"); process.exit(1); }
mkdirSync(INBOX, { recursive: true });

const api = (m, q = "") => `https://api.telegram.org/bot${TOKEN}/${m}${q}`;
const call = async (m, q) => { const r = await fetch(api(m, q)); const j = await r.json(); if (!j.ok) throw new Error(`${m}: ${JSON.stringify(j)}`); return j.result; };

async function download(fileId, chatId) {
  const { file_path } = await call("getFile", `?file_id=${fileId}`);
  const res = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${file_path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const name = `tg-${chatId}-${file_path.split("/").pop()}`;
  writeFileSync(join(INBOX, name), buf);
  return name;
}

async function reply(chatId, text) { try { await call("sendMessage", `?chat_id=${chatId}&text=${encodeURIComponent(text)}`); } catch {} }

let offset = 0;
console.log("telegram-drop polling…");
for (;;) {
  let updates = [];
  try { updates = await call("getUpdates", `?timeout=50&offset=${offset}`); }
  catch (e) { console.error(e.message); await new Promise((r) => setTimeout(r, 5000)); continue; }

  for (const u of updates) {
    offset = u.update_id + 1;
    const msg = u.message;
    if (!msg) continue;
    const chatId = msg.chat?.id;
    if (String(chatId) !== ALLOW) { console.warn(`ignored chat ${chatId}`); continue; }

    // largest photo size, or a PDF/image sent as a document
    const photo = msg.photo?.at(-1);
    const doc = msg.document && /\.(jpe?g|png|webp|gif|pdf)$/i.test(msg.document.file_name || "") ? msg.document : null;
    const fileId = photo?.file_id || doc?.file_id;
    if (!fileId) { if (msg.text) await reply(chatId, "Send a receipt photo or PDF to log it."); continue; }

    try {
      const name = await download(fileId, chatId);
      await reply(chatId, `Got it — queued ${name}. It'll appear in Finance on the next processing run.`);
      console.log(`saved ${name}`);
    } catch (e) {
      await reply(chatId, `Couldn't save that: ${e.message}`);
      console.error(e.message);
    }
  }
}
