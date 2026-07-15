// Self-check for the money path — run: node mission-control/intake/log-expense.test.mjs
// Covers the two acceptance cases (AU tax invoice GST split; overseas gst=0),
// last_logged bump direction, and that bad objects are rejected.
import assert from "node:assert";
import { writeFileSync, mkdtempSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveGst, normaliseExpense, logExpense } from "./log-expense.mjs";

// 1. AU tax invoice: $49.00 inc GST → gst = 49/11 = 4.4545 → 4.45
assert.equal(resolveGst({ amount: 49.0, gst: null, taxable: true }), 4.45);
// stated GST trusted when present
assert.equal(resolveGst({ amount: 110, gst: 10, taxable: true }), 10);
// 2. overseas / GST-free → 0 regardless of amount
assert.equal(resolveGst({ amount: 72.0, gst: null, taxable: false }), 0);
assert.equal(resolveGst({ amount: 72.0, gst: 0, taxable: false }), 0);

// normalise: AU invoice shape
const au = normaliseExpense({ date: "2026-07-15", supplier: "Officeworks ", amount: "49.00", cat: "Equipment", via: "Hermes", taxable: true });
assert.equal(au.gst, 4.45);
assert.equal(au.supplier, "Officeworks");
assert.equal(au.amount, 49);

// normalise: overseas SaaS, gst stays 0
const us = normaliseExpense({ date: "2026-07-14", supplier: "OpenRouter", amount: 72, cat: "AI / LLM", via: "Email", taxable: false });
assert.equal(us.gst, 0);

// validation rejects garbage
assert.throws(() => normaliseExpense({ date: "15/07/2026", supplier: "X", amount: 10 }), /date must be/);
assert.throws(() => normaliseExpense({ date: "2026-07-15", supplier: "", amount: 10 }), /supplier required/);
assert.throws(() => normaliseExpense({ date: "2026-07-15", supplier: "X", amount: -1 }), /amount must be/);
assert.throws(() => normaliseExpense({ date: "2026-07-15", supplier: "X", amount: 10, via: "Fax" }), /via must be/);

// logExpense against a temp board: appends + bumps last_logged forward only
const dir = mkdtempSync(join(tmpdir(), "board-"));
const board = join(dir, "board.json");
writeFileSync(board, JSON.stringify({ finance: { last_logged: "2026-07-10", expenses: [] } }));
logExpense({ date: "2026-07-15", supplier: "Officeworks", amount: 49, cat: "Equipment", via: "Hermes", taxable: true, receipt_url: "/hermes/receipts/x.jpg" }, board);
logExpense({ date: "2026-07-12", supplier: "OpenRouter", amount: 72, cat: "AI / LLM", via: "Email", taxable: false }, board);
const out = JSON.parse(readFileSync(board, "utf8")).finance;
assert.equal(out.expenses.length, 2);
assert.equal(out.expenses[0].receipt_url, "/hermes/receipts/x.jpg");
assert.equal(out.last_logged, "2026-07-15"); // stayed at the later date, not bumped back to 07-12

console.log("ok — all intake money-path checks pass");
