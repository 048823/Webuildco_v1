// Core of the receipt-intake pipeline (WEB-120). Every channel — Telegram
// drop, watch-folder, email-forward — funnels through logExpense(): it is the
// ONE place that validates the expense object, fixes the GST split, appends to
// board.json → finance.expenses[], and bumps finance.last_logged.
//
// No deps, no secrets. board.json is the auth-gated data file the Finance page
// reads. Raw receipt files are NOT stored here — receipt_url points at wherever
// Hermes retained the source (see README); we never commit receipt binaries.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BOARD_PATH = join(HERE, "..", "data", "board.json");

const VIA = new Set(["Email", "Hermes", "Manual", "Watch-folder"]);
const round2 = (n) => Math.round(n * 100) / 100;

// GST rule (AU): a standard tax invoice is GST-inclusive at 1/11 of the total.
// - stated gst present  → trust it (handles mixed-supply invoices), but warn if
//   it's wildly off 1/11 so a bad OCR read gets caught.
// - taxable, no stated gst → compute amount / 11.
// - not taxable (overseas / GST-free supplier) → 0. Default when unsure, because
//   over-claiming GST is the ATO risk, not under-claiming.
export function resolveGst({ amount, gst, taxable }) {
  if (typeof gst === "number" && gst >= 0) {
    if (taxable) {
      const expected = round2(amount / 11);
      if (Math.abs(gst - expected) > Math.max(0.05, expected * 0.02))
        console.warn(`gst ${gst} differs from amount/11 ${expected} — mixed-supply invoice? verify.`);
    }
    return round2(gst);
  }
  return taxable ? round2(amount / 11) : 0;
}

// Validate + normalise into the exact contract shape. Throws on anything the
// Finance UI (or the ATO) would choke on. Money path — fail loud, never guess.
export function normaliseExpense(raw) {
  const e = raw || {};
  const errs = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) errs.push("date must be YYYY-MM-DD");
  if (!e.supplier?.trim()) errs.push("supplier required");
  const amount = Number(e.amount);
  if (!Number.isFinite(amount) || amount <= 0) errs.push("amount must be a positive number");
  const via = e.via || "Hermes";
  if (!VIA.has(via)) errs.push(`via must be one of ${[...VIA].join("|")}`);
  if (errs.length) throw new Error("invalid expense: " + errs.join("; "));

  const gst = resolveGst({ amount: round2(amount), gst: e.gst, taxable: !!e.taxable });
  if (gst > amount) throw new Error(`gst ${gst} exceeds amount ${amount}`);

  const out = {
    date: e.date,
    supplier: e.supplier.trim(),
    desc: (e.desc || "").trim(),
    amount: round2(amount),
    gst,
    cat: (e.cat || "Uncategorised").trim(),
    via,
  };
  if (e.receipt_url) out.receipt_url = String(e.receipt_url); // retained source, off-repo
  return out;
}

// Append one expense to board.json and bump last_logged to the receipt date
// (only ever moves the pill forward, never back). Returns the appended object.
export function logExpense(raw, boardPath = BOARD_PATH) {
  const expense = normaliseExpense(raw);
  const board = JSON.parse(readFileSync(boardPath, "utf8"));
  const fin = (board.finance ||= {});
  (fin.expenses ||= []).push(expense);
  if (!fin.last_logged || expense.date > fin.last_logged) fin.last_logged = expense.date;
  writeFileSync(boardPath, JSON.stringify(board, null, 2) + "\n");
  return expense;
}

// CLI: node log-expense.mjs <expense.json>   (a channel writes the JSON, then calls this)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node log-expense.mjs <expense.json>"); process.exit(1); }
  try {
    const added = logExpense(JSON.parse(readFileSync(file, "utf8")));
    console.log(`logged: ${added.supplier} ${added.amount} (GST ${added.gst}) via ${added.via}`);
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exit(1);
  }
}
