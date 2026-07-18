/* Mission Control — client renderer. Board data comes from data/board.json;
   the APIs and Skills sections are real inventory of this workspace's tooling. */

const $ = (s, r = document) => r.querySelector(s);
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const money = (n, c = "AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
const HEALTH = { ok: "ok", warn: "warn", bad: "bad" };

// ---- Real workspace inventory (APIs / MCPs) ----
const APIS = [
  { name: "Ad platforms (Google, Meta, TikTok, LinkedIn, Amazon)", cat: "Marketing", via: "Adspirer MCP", status: "connected" },
  { name: "Apify (web scraping / actors)", cat: "Data", via: "Apify MCP", status: "connected" },
  { name: "Hostinger — Hosting", cat: "Infra", via: "hostinger-hosting MCP", status: "connected" },
  { name: "Hostinger — Domains & DNS", cat: "Infra", via: "hostinger-domains/dns MCP", status: "connected" },
  { name: "Hostinger — Billing / Subscriptions", cat: "Finance", via: "hostinger-billing MCP", status: "connected" },
  { name: "Hostinger — VPS", cat: "Infra", via: "hostinger-vps MCP", status: "connected" },
  { name: "Hostinger — WordPress", cat: "Infra", via: "hostinger-wordpress MCP", status: "connected" },
  { name: "Hostinger — Reach (email contacts)", cat: "Outbound", via: "hostinger-reach MCP", status: "connected" },
  { name: "Kie.ai (image / video gen)", cat: "Creative", via: "kie-ai MCP", status: "connected" },
  { name: "Excalidraw (diagrams)", cat: "Creative", via: "Excalidraw MCP", status: "connected" },
  { name: "Open-Brain (notes / memory)", cat: "Knowledge", via: "Open-Brain MCP", status: "connected" },
  { name: "Multica workspace API", cat: "Ops", via: "Worker proxy", status: "connected" },
  { name: "Web Search + Web Fetch", cat: "Data", via: "core tools", status: "connected" },
  { name: "Gmail", cat: "Comms", via: "claude.ai connector", status: "needs-auth" },
  { name: "Google Calendar", cat: "Ops", via: "claude.ai connector", status: "needs-auth" },
  { name: "Google Drive", cat: "Docs", via: "claude.ai connector", status: "needs-auth" },
  { name: "Granola (meeting notes)", cat: "Comms", via: "claude.ai connector", status: "needs-auth" },
  { name: "Windsor.ai (marketing data)", cat: "Marketing", via: "claude.ai connector", status: "needs-auth" },
  { name: "Supabase (database)", cat: "Infra", via: "MCP", status: "needs-auth" },
  { name: "Instantly (outbound)", cat: "Outbound", via: "REST API", status: "not-wired" },
  { name: "A-leads (outbound)", cat: "Outbound", via: "REST API", status: "not-wired" },
];

// ---- Real skill inventory, grouped by area ----
const SKILLS = {
  "Design & creative": ["banner-design", "brand", "design", "design-system", "design-taste-frontend", "frontend-design", "ui-styling", "ui-ux-pro-max", "dataviz", "gpt-image-bridge", "media-gen", "scroll-world"],
  "Docs & decks": ["pdf", "pptx", "pitch-deck", "proposal", "slides"],
  "Content & growth": ["content-atomizer", "content-ideas", "research-lead", "deep-research"],
  "Dev & code": ["verify", "code-review", "simplify", "security-review", "review", "run", "init", "graphify", "build-wiki", "claude-api", "skill-creator", "watch"],
  "Multica ops": ["multica-autopilots", "multica-creating-agents", "multica-mentioning", "multica-projects-and-resources", "multica-runtimes-and-repos", "multica-skill-importing", "multica-squads", "multica-working-on-issues"],
  "Automation & config": ["loop", "schedule", "update-config", "keybindings-help", "fewer-permission-prompts"],
  "Style modes": ["caveman", "ponytail", "codex-rescue"],
};

const apiBadge = (s) => ({ "connected": '<span class="badge ok">connected</span>', "needs-auth": '<span class="badge warn">needs auth</span>', "not-wired": '<span class="badge bad">not wired</span>' }[s] || "");
const statusCls = (s) => ({
  done: "ok",
  completed: "ok",
  idle: "ok",
  active: "ok",
  running: "ok",
  blocked: "bad",
  cancelled: "bad",
  failed: "bad",
  in_progress: "warn",
  in_review: "warn",
  todo: "info",
  planned: "info",
  backlog: "",
}[String(s || "").toLowerCase()] || "");
const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};

let DATA = {};
let CREATIVE = {}; // data/creative.json — owned by ECD, drives the Creative section
const hasLiveBlogs = () => Boolean(DATA.multica?.live && DATA.multica?.blogs?.live);
const blogsData = () => hasLiveBlogs() ? DATA.multica.blogs : (DATA.blogs || { columns: [], cards: [] });
const hasLiveLeads = () => Boolean(DATA.multica?.live && DATA.multica?.leads?.live);
const leadsData = () => hasLiveLeads() ? DATA.multica.leads : (DATA.leads || { campaigns: [] });
const doneStatus = (s) => ["done", "completed", "cancelled"].includes(String(s || "").toLowerCase());

const ORG = {
  ceo: "c1b5d4af-1f5f-48c8-a2ee-566d6491e435",
  helper: "70a24bfe-5fb1-4e27-bc13-04153d946bc8",
  csuite: [
    "412a2923-0b41-4f1b-b91a-b35356ae25ba",
    "5b7e92ab-c3b2-4af6-8844-a15d13226128",
    "e440d74d-26e1-425f-a987-b79abb8e24f0",
    "2d981d36-5721-4014-b36f-5c2c1a7eec82",
    "dda981ce-081e-44a7-a584-070f8dcf039e",
    "7c4cc6db-def5-4a65-a8c8-32e38cc40936",
  ],
  squads: [
    {
      name: "Social Media Growth",
      leader: "5b7e92ab-c3b2-4af6-8844-a15d13226128",
      members: ["eea2bdea-f49f-4cdf-b1a9-295ef7919625", "9ecf6baa-33d2-49f0-a613-14f1ee4b0ee7", "858c673a-e2d6-4c48-abfe-3ec24b899f91", "e774e255-f5f2-4f9c-bf50-eec982dd7dfd", "8208c863-1e28-4393-86b8-84cefc58d6c8", "156a6057-4864-4c4d-abc9-0cc27fd41365", "6e930fad-67ce-4323-af82-5d417b57dad1", "e698a23f-beed-4e6c-aa58-1adf0a85023e", "a1a6cdc9-8dcb-482a-bcfb-6c63b4e8768a"],
    },
    {
      name: "Creative Studio",
      leader: "7c4cc6db-def5-4a65-a8c8-32e38cc40936",
      members: ["94a9612e-4b36-487e-9005-dc2f3accc3f6", "4ba6ea05-ce7d-4b6a-b0d2-ff6b484b4fb7", "06f3e0f5-2efc-4dc7-8091-c370146b63d8"],
    },
  ],
  monograms: { CEO: "CE", CTO: "CT", CMO: "CM", CRO: "CR", CFO: "CF", CompetitorScout: "CoS", ContentStrategist: "CnS" },
};

const ORG_SEED = [
  { id: ORG.helper, name: "Multica Helper", status: "idle", role: "Multica usage assistant. Helps create, view, and configure workspace tasks and agents." },
  { id: ORG.ceo, name: "CEO", status: "idle", role: "Strategy and delegation. Takes board instructions and spins up specialists to achieve company goals." },
  { id: "412a2923-0b41-4f1b-b91a-b35356ae25ba", name: "CTO", status: "working", model: "claude-opus-4-8", role: "Head of Engineering. Owns technical delivery, infrastructure, monitoring, security, and code quality." },
  { id: "5b7e92ab-c3b2-4af6-8844-a15d13226128", name: "CMO", status: "idle", model: "claude-opus-4-8", role: "Head of Growth and Marketing. Owns demand generation, positioning, content, social, and lead pipeline." },
  { id: "e440d74d-26e1-425f-a987-b79abb8e24f0", name: "UXDesigner", status: "idle", model: "claude-sonnet-5", role: "Head of Design and Client Experience. Owns UX, interaction design, research, and onboarding." },
  { id: "2d981d36-5721-4014-b36f-5c2c1a7eec82", name: "CRO", status: "working", model: "claude-opus-4-8", role: "Chief Revenue Officer. Owns outbound sales, ICPs, sequences, objections, KPIs, and pipeline growth." },
  { id: "dda981ce-081e-44a7-a584-070f8dcf039e", name: "CFO", status: "idle", model: "claude-opus-4-8", role: "Chief Financial Officer. Owns accounting, tax compliance tracking, budgeting, cash flow, and pricing." },
  { id: "7c4cc6db-def5-4a65-a8c8-32e38cc40936", name: "ExecutiveCreativeDirector", status: "idle", model: "claude-opus-4-8", role: "Executive Creative Director. Leads Creative Studio vision, briefs, approvals, and quality." },
  { id: "eea2bdea-f49f-4cdf-b1a9-295ef7919625", name: "TrendScout", status: "idle", model: "claude-sonnet-5", role: "Trend Intelligence. Monitors AI, business, and tech trends; delivers scored briefings." },
  { id: "9ecf6baa-33d2-49f0-a613-14f1ee4b0ee7", name: "CompetitorScout", status: "idle", model: "claude-sonnet-5", role: "Competitor Intelligence. Tracks competitors, winning hooks, gaps, and positioning opportunities." },
  { id: "858c673a-e2d6-4c48-abfe-3ec24b899f91", name: "ContentStrategist", status: "idle", model: "claude-sonnet-5", role: "Content Strategy. Owns weekly plans, editorial calendar, and content pillars." },
  { id: "e774e255-f5f2-4f9c-bf50-eec982dd7dfd", name: "Brainstormer", status: "idle", model: "claude-sonnet-5", role: "Idea Generation. Turns trends into concrete content ideas across LinkedIn, X, and Instagram." },
  { id: "8208c863-1e28-4393-86b8-84cefc58d6c8", name: "Copywriter", status: "idle", model: "claude-sonnet-5", role: "Content Writing. Writes ready-to-publish platform-native copy in company and founder voices." },
  { id: "156a6057-4864-4c4d-abc9-0cc27fd41365", name: "CreativeDirector", status: "idle", model: "claude-sonnet-5", role: "Creative Direction. Produces carousel outlines, image prompts, and graphic briefs." },
  { id: "6e930fad-67ce-4323-af82-5d417b57dad1", name: "Editor", status: "idle", model: "claude-sonnet-5", role: "Editorial Review. Checks grammar, facts, tone, brand alignment, and platform fit." },
  { id: "e698a23f-beed-4e6c-aa58-1adf0a85023e", name: "Publisher", status: "idle", model: "claude-sonnet-5", role: "Publishing. Owns the Buffer schedule, posting-time optimization, and cadence management." },
  { id: "a1a6cdc9-8dcb-482a-bcfb-6c63b4e8768a", name: "Analyst", status: "idle", model: "claude-sonnet-5", role: "Analytics. Collects performance data and produces optimization and growth reports." },
  { id: "94a9612e-4b36-487e-9005-dc2f3accc3f6", name: "StudioDesigner", status: "idle", model: "claude-sonnet-5", role: "Static visuals, carousels, thumbnails, infographics, banners, and AI image generation." },
  { id: "4ba6ea05-ce7d-4b6a-b0d2-ff6b484b4fb7", name: "MotionDesigner", status: "idle", model: "claude-sonnet-5", role: "AI video and motion production for promos, reels, shorts, and motion graphics." },
  { id: "06f3e0f5-2efc-4dc7-8091-c370146b63d8", name: "BrandGuardian", status: "idle", model: "claude-sonnet-5", role: "Brand consistency and design QA gate. Maintains guidelines, system, and prompt library." },
];

// ---- Section definitions ----
const SECTIONS = [
  { id: "overview", title: "Overview", ic: "◫", desc: "Company at a glance — to-dos, briefs, live snapshot", flag: "manual", render: renderOverview },
  { id: "org", title: "Org", ic: "⌬", desc: "Agent hierarchy, live status, and current work", flag: "live", render: renderOrg },
  { id: "projects", title: "Projects", ic: "▤", desc: "Client pipeline + internal projects", flag: "manual", render: renderProjects },
  { id: "leads", title: "Outbound Leads", ic: "◎", desc: "Instantly & A-leads campaigns", flag: "needs", render: renderLeads },
  { id: "blogs", title: "Upcoming Blogs", ic: "▦", desc: "Blog prep & publish schedule", flag: "manual", render: renderBlogs },
  { id: "creative", title: "Creative", ic: "✎", desc: "Mood boards, ideas pipeline & production schedule", flag: "manual", render: renderCreative },
  { id: "finance", title: "Finance", ic: "$", desc: "Subscriptions birds-eye view", flag: "manual", render: renderFinance },
  { id: "research", title: "Research", ic: "◈", desc: "Latest trending news", flag: "needs", render: renderResearch },
  { id: "apis", title: "APIs & MCPs", ic: "⌁", desc: "Every API and MCP available to the agents", flag: "live", render: renderApis },
  { id: "skills", title: "Skills", ic: "✦", desc: "All installed skills by area", flag: "live", render: renderSkills },
  { id: "planner", title: "Workflow Planner", ic: "⟐", desc: "Compose a workflow from skills + APIs", flag: "live", render: renderPlanner },
  { id: "multica", title: "Multica", ic: "◇", desc: "Workspace activity — tasks, projects & agents", flag: "needs", render: renderMultica },
];

const FLAG_LABEL = { live: "Live", manual: "Manual data", needs: "Needs credential" };

// ---- Section renderers ----
function renderOverview() {
  const d = DATA;
  const projCount = (d.projects?.clients?.length || 0) + (d.projects?.internal?.length || 0);
  const monthly = (d.finance?.subscriptions || []).reduce((s, x) => s + (x.cycle === "annual" ? x.monthly / 12 : x.monthly), 0);
  const blogCount = (blogsData().cards || []).length;
  const outboundCount = hasLiveLeads() ? (leadsData().summary?.projects || 0) : (d.leads?.campaigns || []).length;
  const openTodos = (d.todos || []).filter((t) => !t.done).length;
  return `
  <div class="grid g4">
    ${statCard("Active projects", projCount, "clients + internal")}
    ${statCard("Open to-dos", openTodos, "across the board")}
    ${statCard("Blogs in pipeline", blogCount, "idea → scheduled")}
    ${statCard("Monthly subs", money(monthly), "normalised /mo")}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Daily to-dos</h3>${(d.todos || []).map((t) => `
      <div class="kv"><span class="k">${t.done ? "✓ " : "○ "}${esc(t.text)}</span><span class="v"><span class="badge">${esc(t.owner)}</span></span></div>`).join("") || '<p class="muted">No to-dos.</p>'}</div>
    <div class="card"><h3>Briefs</h3>${(d.briefs || []).map((b) => `
      <div style="padding:10px 0;border-top:1px solid var(--fog)"><div style="font-weight:600">${esc(b.title)}</div><div class="muted tiny" style="margin-top:3px">${esc(b.body)}</div></div>`).join("") || '<p class="muted">No briefs.</p>'}</div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Section snapshot</h3>
    <div class="grid g3">
      ${snap("Projects", `${d.projects?.clients?.length || 0} client · ${d.projects?.internal?.length || 0} internal`, "projects")}
      ${snap("Outbound", outboundCount + (hasLiveLeads() ? " projects" : " campaigns"), "leads")}
      ${snap("Blogs", blogCount + " cards", "blogs")}
      ${snap("Finance", money(monthly) + "/mo", "finance")}
      ${snap("APIs / MCPs", APIS.filter((a) => a.status === "connected").length + " connected", "apis")}
      ${snap("Skills", Object.values(SKILLS).flat().length + " installed", "skills")}
    </div>
  </div>`;
}
const statCard = (label, val, sub) => `<div class="card"><div class="muted tiny">${esc(label)}</div><div class="stat" style="margin-top:6px">${val}</div><div class="muted tiny" style="margin-top:4px">${esc(sub)}</div></div>`;
const snap = (t, v, go) => `<div class="card" style="cursor:pointer;box-shadow:none" data-go="${go}"><div style="font-weight:600">${esc(t)}</div><div class="muted tiny" style="margin-top:4px">${esc(v)} →</div></div>`;

function orgLeaderFor(id) {
  const squad = ORG.squads.find((s) => s.members.includes(id));
  if (squad) return squad.leader;
  if (ORG.csuite.includes(id)) return ORG.ceo;
  return "";
}

function orgGroupFor(id) {
  if (id === ORG.helper) return "workspace";
  if (id === ORG.ceo) return "lead";
  if (ORG.csuite.includes(id)) return "exec";
  if (ORG.squads.some((s) => s.members.includes(id))) return "squad";
  return "exec";
}

function orgTaskFor(agent, issues) {
  if (agent.current) return agent.current;
  const hit = issues.find((issue) => issue.assignee === agent.name || issue.assignee_id === agent.id);
  if (!hit) return null;
  return {
    identifier: hit.identifier || "",
    title: hit.title || "",
    issue_status: hit.status || "",
    live: String(agent.status || "").toLowerCase() === "working" && !doneStatus(hit.status),
  };
}

function orgAgents() {
  const live = DATA.multica?.live && (DATA.multica.agents || []).length;
  const source = live ? DATA.multica.agents : ORG_SEED;
  const seed = new Map(ORG_SEED.map((a) => [a.id, a]));
  const issues = DATA.multica?.issues || [];
  return source.map((agent) => {
    const base = seed.get(agent.id) || {};
    const name = agent.name || base.name || "Agent";
    const role = agent.role || agent.description || agent.responsibility || base.role || "";
    return {
      ...base,
      ...agent,
      name,
      role,
      model: agent.model || base.model || "",
      reports_to: agent.reports_to || orgLeaderFor(agent.id),
      group: agent.group || orgGroupFor(agent.id),
      current: orgTaskFor(agent, issues),
    };
  });
}

function orgMonogram(name) {
  if (ORG.monograms[name]) return ORG.monograms[name];
  const words = String(name || "").replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_-]+/).filter(Boolean);
  if (!words.length) return "AG";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function orgCard(agent, byId) {
  const roleLine = agent.squad_role || (agent.role || "").split(/[.:]/)[0] || "Agent";
  const status = String(agent.status || "idle").toLowerCase();
  const working = status === "working" || status === "running" || status === "active";
  const current = agent.current;
  const reports = agent.reports_to ? (byId.get(agent.reports_to)?.name || "CEO") : "top level";
  const model = agent.model ? `<span class="badge">${esc(agent.model.replace("claude-", ""))}</span>` : `<span class="badge">default model</span>`;
  const currentStatus = current?.issue_status || current?.status || "";
  const task = current ? `
    <div class="org-k">${current.live ? "Working now" : "Recent work"}</div>
    <div class="taskid ${current.live ? "live" : ""}">${esc(current.identifier || "—")} ${current.live ? '<span class="badge ok"><span class="dot"></span>live</span>' : ""}</div>
    <div class="tasktitle">${esc(current.title || "Untitled task")} <span class="badge ${statusCls(currentStatus)}">${esc(currentStatus || "—")}</span></div>`
    : `<div class="org-k">Recent work</div><div class="none">No assigned issue in the latest feed.</div>`;
  return `
    <div class="org-card ${esc(agent.group)}">
      <button class="org-head" type="button" aria-expanded="false">
        <span class="org-avatar ${esc(agent.group)}">${esc(orgMonogram(agent.name))}</span>
        <span class="org-meta">
          <span class="org-name">${esc(agent.name)}</span>
          <span class="org-role" title="${esc(roleLine)}">${esc(roleLine)}</span>
        </span>
        <span class="sdot ${working ? "working" : ""}"></span>
        <span class="chev">▸</span>
      </button>
      <div class="org-detail">
        <div class="org-detail-in">
          <div class="drow">${model}<span class="badge">↳ ${esc(reports)}</span><span class="badge ${statusCls(status)}">${esc(status || "idle")}</span></div>
          <div class="resp">${esc(agent.role || "No responsibility set.")}</div>
          ${task}
        </div>
      </div>
    </div>`;
}

function orgGrid(list, byId) {
  return `<div class="org-grid">${list.map((agent) => orgCard(agent, byId)).join("")}</div>`;
}

function renderOrg() {
  const agents = orgAgents();
  const byId = new Map(agents.map((a) => [a.id, a]));
  const knownIds = new Set([ORG.ceo, ORG.helper, ...ORG.csuite, ...ORG.squads.flatMap((s) => s.members)]);
  const leadership = [byId.get(ORG.ceo), byId.get(ORG.helper)].filter(Boolean);
  const execs = [...ORG.csuite.map((id) => byId.get(id)).filter(Boolean), ...agents.filter((a) => !knownIds.has(a.id) && a.group !== "workspace")];
  const live = DATA.multica?.live;
  const active = agents.filter((a) => ["working", "running", "active"].includes(String(a.status || "").toLowerCase())).length;
  const liveTasks = agents.filter((a) => a.current?.live).length;
  setTimeout(wireOrg, 0);
  return `
  <div class="org-tools">
    <span class="pill ${live ? "live" : "manual"}">${live ? "Live agent data" : "Seed roster"}</span>
    <button class="btn ghost" id="orgRefresh" type="button">Refresh</button>
    <button class="btn primary" id="orgToggle" type="button">Expand all</button>
  </div>
  <div class="grid g4">
    ${statCard("Agents", agents.length, "workspace roster")}
    ${statCard("Working", active, "status from Multica")}
    ${statCard("Live tasks", liveTasks, "assigned work now")}
    ${statCard("Squads", ORG.squads.length, "defined teams")}
  </div>
  <div class="seclabel">Leadership</div>
  ${orgGrid(leadership, byId)}
  <div class="seclabel">C-suite · reports to CEO</div>
  ${orgGrid(execs, byId)}
  ${ORG.squads.map((squad) => {
    const lead = byId.get(squad.leader);
    const members = squad.members.map((id) => byId.get(id)).filter(Boolean);
    if (!members.length) return "";
    return `<div class="cluster org-cluster">
      <div class="cluster-head"><h3>${esc(squad.name)}</h3><span class="lead">led by ${esc(lead?.name || "—")}</span><span class="count">${members.length} agents</span></div>
      ${orgGrid(members, byId)}
    </div>`;
  }).join("")}`;
}

function wireOrg() {
  const root = $("#pg-org");
  if (!root) return;
  root.querySelectorAll(".org-head").forEach((button) => {
    button.onclick = () => {
      const card = button.closest(".org-card");
      const open = card.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
    };
  });
  const toggle = $("#orgToggle");
  if (toggle) toggle.onclick = () => {
    const open = toggle.textContent === "Expand all";
    root.querySelectorAll(".org-card").forEach((card) => {
      card.classList.toggle("open", open);
      card.querySelector(".org-head")?.setAttribute("aria-expanded", String(open));
    });
    toggle.textContent = open ? "Collapse all" : "Expand all";
  };
  const refresh = $("#orgRefresh");
  if (refresh) refresh.onclick = async () => {
    refresh.textContent = "Refreshing";
    await loadMultica();
    go("org");
  };
}

// Radial mind map of DATA.projects — same data as the table below. Rail colour = health
// (ok/warn = green/amber, planned/other = grey), gauge = progress %.
function renderProjectMap(proj) {
  const groups = [
    { name: "Clients", side: -1, nodes: proj?.clients || [] },
    { name: "Internal", side: 1, nodes: proj?.internal || [] },
  ];
  const CW = 214, CH = 60, cx = 750;
  const gap = 106;
  const maxN = Math.max(groups[0].nodes.length, groups[1].nodes.length, 1);
  const H = Math.max(480, maxN * gap + 110);
  const cy = H / 2;
  const HC = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" };
  const link = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2; return `<path d="M${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="var(--line)" stroke-width="2"/>`; };
  const parts = [];
  groups.forEach((g) => {
    const dir = g.side, bx = cx + dir * 210, by = cy, n = g.nodes.length;
    parts.push(link(cx, cy, bx, by));
    const startY = cy - (n - 1) * gap / 2, nodeCx = bx + dir * (CW / 2 + 138);
    g.nodes.forEach((p, i) => {
      const ny = startY + i * gap, left = nodeCx - CW / 2, top = ny - CH / 2;
      const col = HC[p.health] || "var(--steel)";
      const gx = left + 14, gy = top + CH - 16, gw = CW - 62, pct = Math.max(0, Math.min(100, +p.progress || 0));
      parts.push(link(bx + dir * 34, by, nodeCx - dir * CW / 2, ny));
      parts.push(`<g>
        <rect x="${left}" y="${top}" rx="12" width="${CW}" height="${CH}" fill="var(--card)" stroke="var(--line)" stroke-width="1.5"/>
        <rect x="${left}" y="${top}" width="5" height="${CH}" rx="2.5" style="fill:${col}"/>
        <text x="${left + 16}" y="${top + 22}" font-size="13" font-weight="600" style="fill:var(--ink)">${esc(clip(p.name, 24))}</text>
        <text x="${left + 16}" y="${top + 37}" font-size="10" style="fill:var(--slate)">${esc(clip(p.stage || "", 26))}</text>
        <rect x="${gx}" y="${gy}" width="${gw}" height="7" rx="3.5" style="fill:var(--fog)"/>
        <rect x="${gx}" y="${gy}" width="${gw * pct / 100}" height="7" rx="3.5" style="fill:var(--lime-deep)"/>
        <text x="${left + CW - 12}" y="${gy + 8}" font-size="11" font-weight="700" text-anchor="end" style="fill:var(--ink)">${pct}%</text>
      </g>`);
    });
    parts.push(`<g><circle cx="${bx}" cy="${by}" r="34" fill="var(--mist)" stroke="var(--line)" stroke-width="2"/><text x="${bx}" y="${by + 4}" font-size="12" font-weight="700" text-anchor="middle" style="fill:var(--ink)">${g.name}</text></g>`);
  });
  parts.push(`<g><circle cx="${cx}" cy="${cy}" r="46" style="fill:var(--lime)"/><text x="${cx}" y="${cy + 5}" font-size="16" font-weight="700" text-anchor="middle" style="fill:var(--obsidian)">WeBuild</text></g>`);
  return `<div class="card"><h3>Projects mind map</h3><div class="mapwrap"><svg viewBox="0 0 1500 ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;min-width:680px;font-family:'DM Sans',system-ui,sans-serif">${parts.join("")}</svg></div></div>`;
}

function renderProjects() {
  const tbl = (rows) => `<table><thead><tr><th>Project</th><th>Type</th><th>Stage</th><th style="width:160px">Progress</th><th>Due</th></tr></thead><tbody>${rows.map((p) => `
    <tr><td><b>${esc(p.name)}</b></td><td class="muted">${esc(p.type)}</td>
    <td><span class="badge ${HEALTH[p.health] || ""}">${esc(p.stage)}</span></td>
    <td><div class="bar"><span style="width:${p.progress}%"></span></div><span class="tiny muted">${p.progress}%</span></td>
    <td class="muted">${esc(p.due || "—")}</td></tr>`).join("")}</tbody></table>`;
  return renderProjectMap(DATA.projects) +
    `<div class="card" style="margin-top:16px"><h3>Client pipeline</h3>${tbl(DATA.projects?.clients || [])}</div>
    <div class="card" style="margin-top:16px"><h3>Internal projects</h3>${tbl(DATA.projects?.internal || [])}</div>`;
}

function renderLeads() {
  const l = leadsData();
  if (hasLiveLeads()) {
    const projects = l.projects || [];
    const tasks = l.tasks || [];
    const summary = l.summary || {};
    const badge = (s) => `<span class="badge ${statusCls(s)}">${esc(s || "—")}</span>`;
    const projectRows = projects.length ? projects.map((p) => `
      <tr><td><b>${esc(p.title)}</b><div class="tiny muted">${esc(p.lead || "Unassigned")}</div></td>
      <td>${badge(p.status)}</td>
      <td><div class="bar"><span style="width:${Math.max(0, Math.min(100, +p.progress || 0))}%"></span></div><span class="tiny muted">${esc(p.done_count || 0)}/${esc(p.issue_count || 0)} done</span></td>
      <td class="muted">${esc(p.active_tasks || 0)}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">No outbound projects matched.</td></tr>`;
    const taskRows = tasks.length ? tasks.slice(0, 12).map((t) => `
      <tr><td><b>${esc(t.identifier || t.id)}</b></td><td>${esc(t.title)}${t.project ? `<div class="tiny muted">${esc(t.project)}</div>` : ""}</td>
      <td>${badge(t.status)}</td><td class="muted">${esc(t.assignee || "Unassigned")}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">No related outbound tasks returned.</td></tr>`;
    return `<div class="section-note"><b>Live:</b> Derived from Multica projects. Instantly and A-leads sender metrics can be wired later.</div>
    <div class="grid g4">
      ${statCard("Outbound projects", summary.projects ?? projects.length, "from Multica")}
      ${statCard("Related tasks", summary.tasks ?? tasks.length, "matching outbound")}
      ${statCard("Open tasks", summary.open_tasks || 0, "not done")}
      ${statCard("Blocked", summary.blocked || 0, "needs attention")}
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>Outbound projects</h3><table><thead><tr><th>Project</th><th>Status</th><th style="width:160px">Progress</th><th>Open</th></tr></thead><tbody>${projectRows}</tbody></table></div>
      <div class="card"><h3>Related tasks</h3><table><thead><tr><th>ID</th><th>Task</th><th>Status</th><th>Owner</th></tr></thead><tbody>${taskRows}</tbody></table></div>
    </div>`;
  }

  const c = l.campaigns || [];
  return note("Instantly and A-leads API keys are not wired yet — showing seed campaign placeholders.") +
  `<div class="card"><h3>Campaigns</h3><table><thead><tr><th>Tool</th><th>Campaign</th><th>Sent</th><th>Opened</th><th>Replied</th><th>Status</th></tr></thead><tbody>${c.map((x) => `
    <tr><td><span class="badge dark">${esc(x.tool)}</span></td><td>${esc(x.name)}</td><td>${x.sent}</td><td>${x.opened}</td><td>${x.replied}</td>
    <td><span class="badge ${x.status === "needs-key" ? "bad" : "ok"}">${esc(x.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
}

function renderBlogs() {
  const b = blogsData();
  const state = hasLiveBlogs()
    ? `<div class="section-note"><b>Live:</b> Loaded ${(b.cards || []).length} content tasks from Multica.</div>`
    : "";
  return state + `<div class="kan">${b.columns.map((col) => {
    const items = b.cards.filter((c) => c.col === col);
    return `<div class="col"><h4>${esc(col)}<span>${items.length}</span></h4>${items.map((c) => `
      <div class="item">${esc(c.title)}${c.meta ? `<div class="m">${esc(c.meta)}</div>` : ""}</div>`).join("")}</div>`;
  }).join("")}</div>`;
}

// ---- Creative Studio (mood boards + ideas pipeline + schedule) ----
const CR_STATUS = { draft: "", idea: "", review: "warn", "in review": "warn", "in production": "info", approved: "ok", scheduled: "lime" };
const statusPill = (s) => `<span class="badge ${CR_STATUS[String(s || "").toLowerCase()] || ""}">${esc(s || "—")}</span>`;

function renderCreative() {
  const c = CREATIVE;
  setTimeout(wireCreative, 0);
  return `
  <div class="tabs" id="crTabs">
    <button class="tab active" data-tab="boards">Mood boards</button>
    <button class="tab" data-tab="ideas">Ideas</button>
    <button class="tab" data-tab="schedule">Schedule</button>
  </div>
  ${c._note ? `<div class="section-note">${esc(c._note)}</div>` : ""}
  <div class="tabpage active" id="cr-boards">${renderMoodBoards(c.boards || [])}</div>
  <div class="tabpage" id="cr-ideas">${renderIdeas(c.ideas || {})}</div>
  <div class="tabpage" id="cr-schedule">${renderSchedule(c.schedule || [])}</div>
  <div class="lightbox" id="crLightbox"><figure><img alt=""><figcaption></figcaption></figure></div>`;
}

function renderMoodBoards(boards) {
  if (!boards.length) return `<div class="card"><p class="muted">No mood boards yet.</p></div>`;
  return `<div class="grid g2">${boards.map((b) => `
    <div class="card">
      <h3>${esc(b.title || "Untitled")} ${statusPill(b.status)}</h3>
      ${b.direction ? `<p class="muted tiny" style="margin-top:-8px">${esc(b.direction)}</p>` : ""}
      ${(b.palette || []).length ? `<div class="palette">${b.palette.map((hex) => `<span class="sw" style="background:${esc(hex)}" title="${esc(hex)}"></span>`).join("")}</div>` : ""}
      <div class="tiles">${(b.images || []).map((im) => `
        <figure class="tile" data-full="${esc(im.url)}" data-cap="${esc(im.caption || "")}">
          <img src="${esc(im.url)}" alt="${esc(im.caption || "")}" loading="lazy">
          ${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}
        </figure>`).join("") || '<p class="muted tiny">No images.</p>'}</div>
    </div>`).join("")}</div>`;
}

function renderIdeas(ideas) {
  const cols = ideas.columns || ["Idea", "In production", "In review", "Approved", "Scheduled"];
  const cards = ideas.cards || [];
  return `<div class="kan kan5">${cols.map((col) => {
    const items = cards.filter((c) => c.col === col);
    return `<div class="col"><h4>${esc(col)}<span>${items.length}</span></h4>${items.map((c) => `
      <div class="item">
        ${c.thumb ? `<img class="cthumb" src="${esc(c.thumb)}" alt="" loading="lazy">` : ""}
        <div class="t">${esc(c.title || "")}</div>
        <div class="m">${[c.format, c.owner].filter(Boolean).map(esc).join(" · ")}</div>
        ${c.issue ? `<a class="ilink" href="${esc(c.issue)}" target="_blank" rel="noopener">issue ↗</a>` : ""}
      </div>`).join("") || '<p class="muted tiny">—</p>'}</div>`;
  }).join("")}</div>`;
}

function renderSchedule(rows) {
  if (!rows.length) return `<div class="card"><p class="muted">No scheduled slots.</p></div>`;
  return `<div class="card"><h3>Upcoming creative slots</h3><table><thead><tr><th>Date</th><th>Platform</th><th>Asset</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `
    <tr><td class="muted">${esc(r.date || "—")}</td><td>${esc(r.platform || "")}</td><td><b>${esc(r.asset || "")}</b></td><td>${statusPill(r.status)}</td></tr>`).join("")}</tbody></table></div>`;
}

function wireCreative() {
  const tabs = $("#crTabs"); if (!tabs) return;
  tabs.onclick = (e) => {
    const b = e.target.closest(".tab"); if (!b) return;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === b));
    document.querySelectorAll(".tabpage").forEach((p) => p.classList.toggle("active", p.id === "cr-" + b.dataset.tab));
  };
  const lb = $("#crLightbox");
  document.querySelectorAll(".tile[data-full]").forEach((t) => {
    t.onclick = () => { lb.querySelector("img").src = t.dataset.full; lb.querySelector("figcaption").textContent = t.dataset.cap; lb.classList.add("open"); };
  });
  lb.onclick = () => lb.classList.remove("open");
}

function renderFinance() {
  const f = DATA.finance || { subscriptions: [], currency: "AUD" };
  const norm = (x) => x.cycle === "annual" ? x.monthly / 12 : x.monthly;
  const total = f.subscriptions.reduce((s, x) => s + norm(x), 0);
  const byCat = {};
  f.subscriptions.forEach((x) => { byCat[x.cat] = (byCat[x.cat] || 0) + norm(x); });
  return `<div class="grid g3">
    ${statCard("Monthly total", money(total, f.currency), "all subs, normalised")}
    ${statCard("Annualised", money(total * 12, f.currency), "run-rate")}
    ${statCard("Subscriptions", f.subscriptions.length, "tracked")}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>By category (per month)</h3>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
      <div class="kv"><span class="k">${esc(k)}</span><span class="v">${money(v, f.currency)}</span></div>`).join("")}</div>
    <div class="card"><h3>Subscriptions</h3><table><thead><tr><th>Service</th><th>Category</th><th>Cost</th><th>Renews</th></tr></thead><tbody>${f.subscriptions.map((x) => `
      <tr><td><b>${esc(x.name)}</b></td><td class="muted">${esc(x.cat)}</td><td>${money(x.monthly, f.currency)}<span class="tiny muted">/${x.cycle === "annual" ? "yr" : "mo"}</span></td><td class="muted">${esc(x.renews)}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

function renderResearch() {
  const r = DATA.research || { items: [] };
  return note("Manual for now — auto-fill via a news API or Web Search on a schedule.") +
  `<div class="card"><h3>Trending / relevant</h3><div class="rowlist">${r.items.map((x) => `
    <div class="row"><span class="badge info">${esc(x.tag)}</span><span class="name">${esc(x.title)}</span><span class="meta">${esc(x.source)} · ${esc(x.date)}</span></div>`).join("")}</div></div>`;
}

function renderApis() {
  const cats = [...new Set(APIS.map((a) => a.cat))].sort();
  const conn = APIS.filter((a) => a.status === "connected").length;
  return `<div class="grid g3">
    ${statCard("Connected", conn, "ready to use")}
    ${statCard("Needs auth", APIS.filter((a) => a.status === "needs-auth").length, "one-time connect")}
    ${statCard("Not wired", APIS.filter((a) => a.status === "not-wired").length, "no integration yet")}
  </div>
  ${cats.map((cat) => `<div class="card" style="margin-top:16px"><h3>${esc(cat)}</h3><div class="rowlist">${APIS.filter((a) => a.cat === cat).map((a) => `
    <div class="row"><span class="name">${esc(a.name)}</span> ${apiBadge(a.status)}<span class="meta">${esc(a.via)}</span></div>`).join("")}</div></div>`).join("")}`;
}

function renderSkills() {
  const total = Object.values(SKILLS).flat().length;
  return `<div class="card"><h3>${total} skills installed <span class="pill live">Live</span></h3><p class="muted tiny" style="margin-top:-6px">Grouped by area. Each is invokable by the agents.</p></div>` +
  Object.entries(SKILLS).map(([area, list]) => `<div class="card" style="margin-top:16px"><h3>${esc(area)} <span class="badge">${list.length}</span></h3><div class="chips">${list.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>`).join("");
}

function renderPlanner() {
  const all = [...Object.values(SKILLS).flat().map((s) => ({ t: "skill", n: s })), ...APIS.map((a) => ({ t: "api", n: a.name }))];
  const saved = JSON.parse(localStorage.getItem("mc_workflow") || "[]");
  setTimeout(() => wirePlanner(all, saved), 0);
  return `<div class="section-note">Pick skills and APIs to sketch a workflow, then <b>Save</b> — stored in this browser. Hand a saved sequence to the CTO to build as a real Multica autopilot.</div>
  <div class="wf">
    <div class="card"><h3>Available</h3><input id="wfSearch" placeholder="Filter…" style="width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:10px;font-family:inherit">
      <div class="rowlist pick" id="wfPick"></div></div>
    <div class="card"><h3>Your workflow <span class="pill" id="wfCount"></span></h3>
      <div class="steps" id="wfSteps"></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" id="wfSave">Save</button><button class="btn ghost" id="wfClear">Clear</button></div>
    </div>
  </div>`;
}
function wirePlanner(all, saved) {
  let steps = saved.slice();
  const pick = $("#wfPick"), stepsEl = $("#wfSteps"), count = $("#wfCount"), search = $("#wfSearch");
  const drawPick = (q = "") => {
    pick.innerHTML = all.filter((x) => x.n.toLowerCase().includes(q.toLowerCase())).map((x, i) => `
      <div class="row" data-add="${esc(x.n)}" data-t="${x.t}"><span class="badge ${x.t === "skill" ? "lime" : "info"}">${x.t}</span><span class="name">${esc(x.n)}</span></div>`).join("");
  };
  const drawSteps = () => {
    count.textContent = steps.length + " steps";
    stepsEl.innerHTML = steps.length ? steps.map((s, i) => `<div class="step"><span class="n">${i + 1}</span>${esc(s)}<button data-rm="${i}">×</button></div>`).join("") : '<p class="muted tiny">Empty — add from the left.</p>';
  };
  drawPick(); drawSteps();
  search.oninput = () => drawPick(search.value);
  pick.onclick = (e) => { const r = e.target.closest("[data-add]"); if (r) { steps.push(r.dataset.add); drawSteps(); } };
  stepsEl.onclick = (e) => { const b = e.target.closest("[data-rm]"); if (b) { steps.splice(+b.dataset.rm, 1); drawSteps(); } };
  $("#wfSave").onclick = () => { localStorage.setItem("mc_workflow", JSON.stringify(steps)); $("#wfSave").textContent = "Saved ✓"; setTimeout(() => $("#wfSave").textContent = "Save", 1200); };
  $("#wfClear").onclick = () => { steps = []; drawSteps(); };
}

function renderMultica() {
  const m = DATA.multica || { issues: [], agents: [] };
  const projects = m.projects || [];
  const issues = m.issues || [];
  const agents = m.agents || [];
  const sum = m.summary || {};
  const taskStatus = sum.task_status || {};
  const badge = (s) => `<span class="badge ${statusCls(s)}">${esc(s || "—")}</span>`;
  const state = m.live
    ? `<div class="section-note"><b>Live:</b> Multica API refreshed ${esc(fmtDate(m.updated))}. Showing ${esc(sum.recent_tasks || issues.length)} recent tasks.</div>`
    : `<div class="section-note"><b>Fallback:</b> ${esc(m.error || "Multica API is not configured yet. Seed data shown.")}</div>`;
  const projectRows = projects.length ? projects.slice(0, 12).map((p) => `
    <tr><td><b>${esc(p.title)}</b><div class="tiny muted">${esc(p.lead || "Unassigned")}</div></td>
    <td>${badge(p.status)}</td>
    <td><div class="bar"><span style="width:${Math.max(0, Math.min(100, +p.progress || 0))}%"></span></div><span class="tiny muted">${esc(p.done_count || 0)}/${esc(p.issue_count || 0)} done</span></td>
    <td class="muted">${esc(fmtDate(p.updated_at))}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">No live projects returned.</td></tr>`;
  const issueRows = issues.length ? issues.slice(0, 14).map((i) => `
    <tr><td><b>${esc(i.identifier || i.id)}</b></td><td>${esc(i.title)}${i.project ? `<div class="tiny muted">${esc(i.project)}</div>` : ""}</td>
    <td>${badge(i.status)}</td><td class="muted">${esc(i.assignee || "Unassigned")}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">No live tasks returned.</td></tr>`;
  const agentRows = agents.length ? agents.map((a) => `
    <div class="kv"><span class="k"><b>${esc(a.name)}</b><span class="tiny muted" style="display:block">${esc(clip(a.role || "", 64))}</span></span><span class="v">${badge(a.status || "listed")}</span></div>`).join("") : '<p class="muted">No agents returned.</p>';
  return state + `
  <div class="grid g4">
    ${statCard("Projects", sum.projects ?? projects.length, "live project rows")}
    ${statCard("Tasks", sum.tasks ?? issues.length, "workspace total")}
    ${statCard("Blocked", taskStatus.blocked || 0, "in recent tasks")}
    ${statCard("Agents", sum.agents ?? agents.length, "workspace agents")}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Projects · ${esc(m.workspace || "Multica")}</h3><table><thead><tr><th>Project</th><th>Status</th><th style="width:160px">Progress</th><th>Updated</th></tr></thead><tbody>${projectRows}</tbody></table></div>
    <div class="card"><h3>Recent tasks</h3><table><thead><tr><th>ID</th><th>Task</th><th>Status</th><th>Owner</th></tr></thead><tbody>${issueRows}</tbody></table></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Agents</h3>${agentRows}</div>`;
}

const note = (t) => `<div class="section-note"><b>Placeholder:</b> ${esc(t)}</div>`;

// ---- Router / shell ----
function buildNav() {
  $("#nav").innerHTML = SECTIONS.map((s) => `<a data-id="${s.id}"><span class="ic">${s.ic}</span>${s.title}</a>`).join("");
  $("#pages").innerHTML = SECTIONS.map((s) => `<section class="page" id="pg-${s.id}"></section>`).join("");
}
function go(id) {
  const s = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.id === s.id));
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const pg = $("#pg-" + s.id);
  pg.innerHTML = s.render();
  pg.classList.add("active");
  $("#ptitle").textContent = s.title;
  $("#pdesc").textContent = s.desc;
  const flag = $("#pflag");
  const pageFlag = s.id === "org" ? (DATA.multica?.live ? "live" : "manual") :
    (s.id === "multica" && DATA.multica?.live) || (s.id === "blogs" && hasLiveBlogs()) || (s.id === "leads" && hasLiveLeads()) ? "live" : s.flag;
  flag.className = "pill " + pageFlag;
  flag.textContent = FLAG_LABEL[pageFlag];
  $("#side").classList.remove("open");
  location.hash = s.id;
}

async function loadMultica() {
  try {
    const res = await fetch("/mission-control/api/multica", { cache: "no-store" });
    const live = await res.json();
    if (!res.ok || live.ok === false) throw new Error(live.message || live.error || "Multica API unavailable");
    DATA.multica = live;
  } catch (err) {
    DATA.multica = { ...(DATA.multica || {}), live: false, error: err.message || "Multica API unavailable" };
  }
}

async function boot() {
  buildNav();
  try { DATA = await (await fetch("/mission-control/data/board.json", { cache: "no-store" })).json(); }
  catch { DATA = {}; }
  try { CREATIVE = await (await fetch("/mission-control/data/creative.json", { cache: "no-store" })).json(); }
  catch { CREATIVE = {}; }
  await loadMultica();
  $("#upd").textContent = DATA.updated ? "updated " + DATA.updated : "";
  document.addEventListener("click", (e) => {
    const nav = e.target.closest(".nav a"); if (nav) return go(nav.dataset.id);
    const snap = e.target.closest("[data-go]"); if (snap) return go(snap.dataset.go);
  });
  $("#hamb").onclick = () => $("#side").classList.toggle("open");
  go(location.hash.slice(1) || "overview");
}
boot();
