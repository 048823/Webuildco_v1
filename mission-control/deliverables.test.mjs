// Deliverables section — data integrity + wiring. Every row in deliverables.json
// points at a client id the UI can resolve; a typo would silently render "—".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
