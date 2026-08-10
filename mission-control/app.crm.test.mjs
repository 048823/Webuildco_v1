// Covers the only non-DOM logic the CRM section adds: CSV export escaping and the
// seed + browser-local row merge. app.js is a browser script, so it runs inside a vm
// context with the few globals boot() touches stubbed out.
// ponytail: no jsdom — stub what boot() reaches for, assert the pure bits.
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

function loadApp(localStore = {}) {
  const raw = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const src = raw.replace(/\nboot\(\);\s*$/, "\n"); // drop the browser entry point; we only want the definitions
  assert.notEqual(src, raw, "app.js should still end with boot();");
  const ctx = {
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ innerHTML: "" }) },
    window: { addEventListener() {} },
    location: { hash: "" },
    localStorage: { getItem: (k) => (k in localStore ? localStore[k] : null), setItem: (k, v) => { localStore[k] = v; } },
    fetch: async () => { throw new Error("no network in tests"); },
    setTimeout, Intl, URL, console,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const run = (expr) => vm.runInContext(expr, ctx);
  run(`DATA = { crm: { companies: [{ name: 'Bounce, Inc "AU"', industry: 'Retail', country: 'Australia', website: '' }] } }`);
  return run;
}

test("CSV export quotes every field and doubles embedded quotes", () => {
  const run = loadApp();
  const csv = run(`crmCsv("companies")`);
  assert.equal(csv.split("\r\n")[0], '"Name","Industry","Country","Website"');
  assert.equal(csv.split("\r\n")[1], '"Bounce, Inc ""AU""","Retail","Australia",""');
});

test("locally added rows append to the seed rows and carry a local index", () => {
  const run = loadApp({ mc_crm: JSON.stringify({ companies: [{ name: "Added Co", industry: "Ops" }] }) });
  const rows = run(`crmRows("companies")`);
  // join, not deepEqual — vm arrays come from another realm and fail reference-equality
  assert.equal(rows.map((r) => r.name).join("|"), 'Bounce, Inc "AU"|Added Co');
  assert.equal(rows[0]._local, undefined); // seed rows are not deletable
  assert.equal(rows[1]._local, 0);
  assert.equal(run(`crmCsv("companies")`).split("\r\n").length, 3);
});
