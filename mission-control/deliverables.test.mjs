// Deliverables section — data integrity + wiring. Every row in deliverables.json
// points at a client id the UI can resolve; a typo would silently render "—".
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("./", import.meta.url);
const data = JSON.parse(readFileSync(new URL("data/deliverables.json", root), "utf8"));
const app = readFileSync(new URL("app.js", root), "utf8");

const ids = new Set(data.clients.map((c) => c.id));
ids.add("webuild"); // internal deployments are not a client

const refs = [
  ...data.projects.map((p) => ["projects", p.client]),
  ...data.tasks.map((t) => ["tasks", t.client]),
  ...data.time.entries.map((e) => ["time.entries", e.client]),
  ...data.time.retainers.map((r) => ["time.retainers", r.client]),
  ...data.deployments.map((d) => ["deployments", d.client]),
  ...data.portal.approvals.map((a) => ["portal.approvals", a.client]),
  ...data.portal.invoices.map((i) => ["portal.invoices", i.client]),
];

test("every client reference resolves", () => {
  for (const [where, id] of refs) assert.ok(ids.has(id), `${where}: unknown client id "${id}"`);
});

test("tasks sit in a declared column", () => {
  const cols = new Set(data.task_columns);
  for (const t of data.tasks) assert.ok(cols.has(t.col), `task "${t.title}" has column "${t.col}"`);
});

test("task and approval projects exist", () => {
  const names = new Set(data.projects.map((p) => p.name));
  for (const t of data.tasks) assert.ok(names.has(t.project), `task "${t.title}" → unknown project`);
  for (const a of data.portal.approvals) assert.ok(names.has(a.project), `approval "${a.item}" → unknown project`);
});

test("sample clients are flagged demo, real pipeline entries are not", () => {
  for (const c of data.clients) {
    const real = c.id === "optora" || c.id === "awqaf";
    assert.equal(Boolean(c.demo), !real, `client "${c.name}" demo flag is wrong`);
  }
});

test("app.js loads the file and registers the section", () => {
  assert.match(app, /mission-control\/data\/deliverables\.json/);
  assert.match(app, /id: "deliverables"/);
});

// WEB-723 — the sample clients used to render identically to Optora and Awqaf on every tab
// but the Clients table, so a retainer bar read "Northshore Plumbing Co  5.5h / 8h" with
// nothing on screen saying it was invented. Render the real section and prove no demo name
// reaches the page unlabelled. ponytail: no jsdom — vm context with boot()'s globals stubbed,
// same trick as app.crm.test.mjs.
function renderTabs() {
  const raw = readFileSync(new URL("./app.js", root), "utf8");
  const src = raw.replace(/\nboot\(\);\s*$/, "\n");
  assert.notEqual(src, raw, "app.js should still end with boot();");
  const ctx = {
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ innerHTML: "" }) },
    window: { addEventListener() {} },
    location: { hash: "" },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => { throw new Error("no network in tests"); },
    setTimeout, Intl, URL, console,
  };
  vm.createContext(ctx);
  const settings = new URL("./settings.js", root);
  if (existsSync(settings)) vm.runInContext(readFileSync(settings, "utf8"), ctx);
  vm.runInContext(src, ctx);
  vm.runInContext(`DELIV = ${JSON.stringify(data)}`, ctx);
  const tabs = JSON.parse(vm.runInContext("JSON.stringify(DELIV_TABS.map((t) => t[0]))", ctx));
  return tabs.map((tab) => [tab, vm.runInContext(`renderDeliverables(${JSON.stringify([tab])})`, ctx)]);
}

test("no demo client renders without a DEMO label next to its name", () => {
  const demos = data.clients.filter((c) => c.demo);
  assert.ok(demos.length, "expected at least one demo client to guard");
  for (const [tab, html] of renderTabs()) {
    for (const c of demos) {
      const after = html.split(c.name).slice(1); // every place this name hits the page
      for (const [i, tail] of after.entries()) {
        assert.match(tail.slice(0, 90), /DEMO/,
          `${tab} tab: "${c.name}" occurrence ${i + 1} renders with no DEMO marker — a board member reads it as a paying client (WEB-723)`);
      }
    }
  }
});

test("a money tile fed only by demo clients says so", () => {
  const billable = data.time.entries.filter((e) => e.billable);
  const byDemo = new Set(data.clients.filter((c) => c.demo).map((c) => c.id));
  if (!billable.every((e) => byDemo.has(e.client))) return; // real billable hours exist — tile is honest as-is
  for (const [tab, html] of renderTabs()) {
    if (tab !== "clients" && tab !== "time") continue;
    assert.match(html, /demo clients only — not revenue/,
      `${tab} tab: every billable hour comes from a demo client, so the dollar tile must not read as revenue (WEB-723)`);
  }
});
