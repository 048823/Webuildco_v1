// Receipt → expense fields via Claude vision (WEB-120). Given a receipt image
// or PDF, returns the raw expense object that log-expense.mjs then validates.
//
// Key via env only (ANTHROPIC_API_KEY) — never in the repo. Model is the
// current default vision-capable Claude; override with ANTHROPIC_MODEL.

import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const MEDIA = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" };

const PROMPT = `You are a bookkeeping OCR for an Australian business. Read this receipt/tax invoice and return ONLY a JSON object, no prose:
{"date":"YYYY-MM-DD","supplier":"","desc":"short line-item summary","amount":<GST-inclusive total as number>,"gst":<GST amount stated on invoice, or null if none stated>,"cat":"one of: AI / LLM, Software, Infra, Equipment, Marketing, Outbound, Ops, Travel, Meals, Other","taxable":<true only if this is a valid AU tax invoice showing GST or an ABN + "Tax Invoice"; false for overseas or GST-free suppliers>}
Rules: amount = the final total paid, GST-inclusive. If the invoice states a GST line, put that number in gst; otherwise gst=null. taxable=false when the supplier is overseas (e.g. US SaaS) or the invoice is not a valid AU tax invoice — then gst stays 0 downstream. Date is the invoice/purchase date.`;

export async function extractExpense(filePath, via = "Hermes") {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const media = MEDIA[extname(filePath).toLowerCase()];
  if (!media) throw new Error(`unsupported file type: ${filePath}`);

  const data = readFileSync(filePath).toString("base64");
  const source = { type: "base64", media_type: media, data };
  const content = [
    media === "application/pdf" ? { type: "document", source } : { type: "image", source },
    { type: "text", text: PROMPT },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 512, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const text = json.content?.map((b) => b.text || "").join("") || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON in model reply: ${text.slice(0, 200)}`);

  const fields = JSON.parse(match[0]);
  fields.via = via;
  fields.receipt_url = process.env.RECEIPT_BASE ? `${process.env.RECEIPT_BASE}/${basename(filePath)}` : basename(filePath);
  return fields;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const f = process.argv[2];
  if (!f) { console.error("usage: node extract.mjs <receipt-file>"); process.exit(1); }
  extractExpense(f).then((e) => console.log(JSON.stringify(e, null, 2))).catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
}
