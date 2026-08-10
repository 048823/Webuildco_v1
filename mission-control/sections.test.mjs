// WEB-680 — five Mission Control PRs stack on top of each other and every one of them
// edits the same SECTIONS table. The failure mode is silent: a section whose `render`
// points at a function that no longer exists throws only when someone clicks that nav
// item, and a duplicated id shadows a whole page. Neither shows up in any other test.
//
// Board default #3 also lives here: the taxonomy is PR #68's (Company / Marketing /
// System), with #66's Sales and Outbound folded in rather than kept as their own groups.
// ponytail: no jsdom — same vm stub as app.crm.test.mjs, assert the table not the DOM.
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const GROUPS = ["Company", "Marketing", "System"];

function loadApp() {
  const raw = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const src = raw.replace(/\nboot\(\);\s*$/, "\n");
  assert.notEqual(src, raw, "app.js should still end with boot();");
  const ctx = {
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ innerHTML: "" }) },
    window: { addEventListener() {} },
    location: { hash: "" },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    fetch: async () => { throw new Error("no network in tests"); },
    setTimeout, Intl, URL, console,
  };
  vm.createContext(ctx);
  // app.js reads globalThis.MCSettings at load (WEB-543); in the browser settings.js is a
  // classic <script> ahead of it, so give the vm context the same global.
  const settings = new URL("./settings.js", import.meta.url);
  if (existsSync(settings)) vm.runInContext(readFileSync(settings, "utf8"), ctx);
  vm.runInContext(src, ctx);
  return (expr) => vm.runInContext(expr, ctx);
}

test("every section has a render function that exists", () => {
  const run = loadApp();
  const bad = run(`SECTIONS.filter((s) => typeof s.render !== "function").map((s) => s.id)`);
  assert.deepEqual([...bad], [], "section renders a function that is not defined");
});

test("section ids are unique — a duplicate id hides a page", () => {
  const run = loadApp();
  const ids = [...run(`SECTIONS.map((s) => s.id)`)];
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test("the sidebar taxonomy is PR #68's, with Sales and Outbound folded in", () => {
  const run = loadApp();
  const groups = [...new Set([...run(`SECTIONS.map((s) => s.grp)`)])];
  assert.deepEqual(groups, GROUPS, `sidebar groups drifted from the WEB-680 board default`);
});

test("sections are contiguous by group, so the nav renders one heading each", () => {
  const run = loadApp();
  const seq = [...run(`SECTIONS.map((s) => s.grp)`)];
  const headings = seq.filter((g, i) => g !== seq[i - 1]);
  assert.deepEqual(headings, GROUPS);
});
