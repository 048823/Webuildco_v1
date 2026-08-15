// Same brief JSON, delivery renderers. No browser/email-client JS required.

import { deflateSync } from "node:zlib";

const LABELS = {
  morning: ["Morning Brief", "Overnight - what shipped", "Top 3 - stay ahead today"],
  eod: ["End of Day Brief", "Today - what got done", "Top 3 - for tomorrow"],
  weekly: ["Weekly Brief", "Wins this week", "Top 3 - next week"],
  monthly: ["Monthly Brief", "Wins this month", "Top 3 - next month"],
  quarterly: ["Quarterly Brief", "Wins this quarter", "Top 3 - next quarter"],
  yearly: ["End of Year Brief", "Wins this year", "Top 3 - next year"],
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const label = (brief) => LABELS[brief.type] || ["Brief", "Wins", "Top 3"];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
}

export function barChartPng(values, width = 640, height = 180) {
  const px = Buffer.alloc((width * 4 + 1) * height);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * (width * 4 + 1) + 1 + x * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  for (let y = 0; y < height; y++) {
    px[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) set(x, y, 255, 255, 255);
  }
  const nums = values.length ? values : [0];
  const max = Math.max(1, ...nums);
  const pad = 28, base = height - pad, plotH = height - pad * 2;
  const gap = 10, bw = Math.max(8, Math.floor((width - pad * 2 - gap * (nums.length - 1)) / nums.length));
  for (let x = pad; x < width - pad; x++) set(x, base, 228, 228, 231);
  nums.forEach((v, i) => {
    const h = Math.round((v / max) * plotH);
    const left = pad + i * (bw + gap);
    for (let y = base - h; y < base; y++) for (let x = left; x < left + bw; x++) set(x, y, 200, 230, 54);
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(px)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

function trendValues(brief, allBriefs) {
  return [...allBriefs]
    .filter((b) => b.type === brief.type)
    .sort((a, b) => String(a.generated_at || "").localeCompare(String(b.generated_at || "")))
    .slice(-7)
    .map((b) => (b.wins || []).length);
}

export function emailSubject(brief) {
  return `[${label(brief)[0]}] ${brief.period_label || ""}`.trim();
}

export function renderEmailHtml(brief, allBriefs = []) {
  const [name, winsTitle, nextTitle] = label(brief);
  const chart = barChartPng(trendValues(brief, allBriefs));
  const list = (items, ordered = false) => `<${ordered ? "ol" : "ul"}>${(items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;color:#18181b;font-family:'DM Sans',Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px"><tr><td align="center">
  <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
    <tr><td style="background:#09090b;color:#fff;padding:18px 22px"><strong>${esc(name)}</strong><div style="color:#a1a1aa;font-size:13px;margin-top:4px">${esc(brief.period_label || "")}</div></td></tr>
    <tr><td style="padding:20px 22px"><h2 style="font-size:16px;margin:0 0 10px">${esc(winsTitle)}</h2>${list(brief.wins)}</td></tr>
    <tr><td style="padding:0 22px 20px"><h2 style="font-size:16px;margin:0 0 10px">${esc(nextTitle)}</h2>${list(brief.next3, true)}</td></tr>
    ${(brief.industry_pulse || []).length ? `<tr><td style="padding:0 22px 20px"><h2 style="font-size:16px;margin:0 0 10px">Industry pulse</h2>${list(brief.industry_pulse)}</td></tr>` : ""}
    <tr><td style="padding:0 22px 22px"><img alt="Brief trend chart" width="596" style="width:100%;border:1px solid #ececee;border-radius:8px" src="data:image/png;base64,${chart}"></td></tr>
    <tr><td style="padding:16px 22px;border-top:1px solid #ececee;font-size:13px"><a href="/mission-control/#/briefs/${encodeURIComponent(brief.id)}" style="color:#18181b;font-weight:700">Open in Mission Control</a></td></tr>
  </table></td></tr></table></body></html>`;
}

export function renderTelegramText(brief) {
  const [name, winsTitle, nextTitle] = label(brief);
  const bullets = (items = []) => items.slice(0, 5).map((item) => `- ${item}`).join("\n");
  const nums = (items = []) => items.slice(0, 3).map((item, i) => `${i + 1}. ${item}`).join("\n");
  return `${name} - ${brief.period_label || ""}

${winsTitle}
${bullets(brief.wins)}

${nextTitle}
${nums(brief.next3)}
${(brief.industry_pulse || []).length ? `\nIndustry pulse\n${bullets(brief.industry_pulse)}` : ""}

Open in Mission Control: /mission-control/#/briefs/${brief.id}`.trim();
}
