// Runnable check for the session-token scheme: node worker.test.mjs
import assert from "node:assert";
import worker, { makeToken, normalizeMultica, validToken } from "./worker.js";

const secret = "test-secret-please-change";
const token = await makeToken(secret);

assert(await validToken(secret, token), "fresh token must validate");
assert(!(await validToken("wrong-secret", token)), "wrong secret must fail");
assert(!(await validToken(secret, token.slice(0, -2) + "xx")), "tampered signature must fail");
assert(!(await validToken(secret, "9999999999.deadbeef")), "forged signature must fail");
assert(!(await validToken(secret, "0.anything")), "expired token must fail");
assert(!(await validToken(secret, "")), "empty token must fail");

const normalized = normalizeMultica({
  workspaceName: "WeBuild Co",
  projects: [
    { id: "p1", title: "Mission Control", status: "planned", done_count: 2, issue_count: 4, lead_id: "a1" },
    { id: "p2", title: "Place", status: "active", done_count: 3, issue_count: 8, lead_id: "a1" },
    { id: "p3", title: "Leads Pipeline", status: "in_progress", done_count: 5, issue_count: 14, lead_id: "a1" },
  ],
  issues: { total: 12, issues: [
    { id: "i1", identifier: "WEB-1", title: "Wire API", status: "blocked", assignee_id: "a1", project_id: "p1" },
    { id: "i2", identifier: "WEB-62", title: "Outbound playbooks for Priority 1 industries", status: "in_review", assignee_id: "a1", project_id: "p3" },
  ] },
  blogIssues: [
    { id: "b1", identifier: "WEB-79", title: "Agentic content engine: automated weekly SEO/GEO publishing cadence", status: "in_review", assignee_id: "a1", project_id: "p2", updated_at: "2026-07-17T00:00:00Z" },
    { id: "b2", identifier: "WEB-168", title: "Content ideas — 2026-07-17", status: "in_review", assignee_id: "a1", project_id: "p2", updated_at: "2026-07-17T01:00:00Z" },
  ],
  agents: [{ id: "a1", name: "CTO", description: "Technical delivery", status: "working" }],
});

assert.equal(normalized.workspace, "WeBuild Co");
assert.equal(normalized.summary.tasks, 12);
assert.equal(normalized.summary.task_status.blocked, 1);
assert.equal(normalized.projects[0].progress, 50);
assert.equal(normalized.projects[0].lead, "CTO");
assert.equal(normalized.issues[0].project, "Mission Control");
assert.equal(normalized.issues[0].assignee, "CTO");
assert.equal(normalized.agents[0].status, "working");
assert.equal(normalized.summary.blogs, 1);
assert.equal(normalized.blogs.live, true);
assert.equal(normalized.blogs.cards[0].title, "Agentic content engine: automated weekly SEO/GEO publishing cadence");
assert.equal(normalized.blogs.cards[0].col, "Review");
assert.equal(normalized.blogs.cards[0].project, "Place");
assert(!normalized.blogs.cards.some((card) => card.title.startsWith("Content ideas")));
assert.equal(normalized.summary.leads.projects, 1);
assert.equal(normalized.leads.live, true);
assert.equal(normalized.leads.projects[0].title, "Leads Pipeline");
assert.equal(normalized.leads.tasks[0].title, "Outbound playbooks for Priority 1 industries");
assert.equal(normalized.leads.tasks[0].project, "Leads Pipeline");

const shell = `<!doctype html><title>Mission Control · WeBuild</title><script src="/mission-control/app.js"></script>`;
const briefs = JSON.stringify([{ id: "eod-2026-07-28", type: "eod" }]);
const env = {
  MC_SECRET: secret,
  MC_PASSWORD: "password",
  ASSETS: {
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/mission-control/" || path === "/mission-control") return new Response(shell);
      if (path === "/mission-control/app.js") return new Response("go('briefs')");
      if (path === "/mission-control/data/briefs.json") return new Response(briefs, { headers: { "Content-Type": "application/json" } });
      return new Response("missing", { status: 404 });
    },
  },
};

let res = await worker.fetch(new Request("https://webuild.example/mission-control/api/deploy-health?brief=eod-2026-07-28"), env);
assert.equal(res.status, 200);
let body = await res.json();
assert.equal(body.ok, true);
assert.equal(body.app_shell, true);
assert.equal(body.briefs_json, true);
assert.equal(body.brief.present, true);

res = await worker.fetch(new Request("https://webuild.example/mission-control/api/deploy-health?brief=eod-2026-07-29"), env);
assert.equal(res.status, 503);
body = await res.json();
assert.deepEqual(body.errors, ["brief_missing"]);

res = await worker.fetch(new Request("https://webuild.example/mission-control/data/briefs.json"), env);
assert.equal(res.headers.get("Content-Type"), "text/html; charset=utf-8");
assert(await res.text().then((text) => text.includes("Mission Control — Sign in")));

console.log("ok: worker auth + multica normalization");
