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
let MARKETING = {}; // data/marketing.json — owned by CMO, drives the Marketing group
let BRIEFS = []; // data/briefs.json — generated from Board Reports / Daily Logs
let DELIV = {}; // data/deliverables.json — client delivery: clients, projects, tasks, time, deployments, portal
const hasLiveBlogs = () => Boolean(DATA.multica?.live && DATA.multica?.blogs?.live);
const blogsData = () => hasLiveBlogs() ? DATA.multica.blogs : (DATA.blogs || { columns: [], cards: [] });
const hasLiveLeads = () => Boolean(DATA.multica?.live && DATA.multica?.leads?.live);
const leadsData = () => hasLiveLeads() ? DATA.multica.leads : (DATA.leads || { campaigns: [] });

// ---- Section definitions ----
// `grp` drives the sidebar headings; sections render in this order within a group.
const SECTIONS = [
  // WEB-680 board default #3: this is PR #68's taxonomy (Company / Marketing / System).
  // PR #66's Sales and Outbound groups are folded into it rather than kept as top-level groups.
  { id: "overview", grp: "Company", title: "Overview", ic: "◫", desc: "Company at a glance — to-dos, briefs, live snapshot", flag: "manual", render: renderOverview },
  { id: "briefs", grp: "Company", title: "Briefs", ic: "▥", desc: "Morning, EOD & cadence reports", flag: "manual", render: renderBriefs },
  { id: "projects", grp: "Company", title: "Projects", ic: "▤", desc: "Client pipeline + internal projects", flag: "manual", render: renderProjects },
  { id: "deliverables", grp: "Company", title: "Deliverables", ic: "▣", desc: "Client work & progress — projects, tasks, time, deployments, portal", flag: "manual", render: renderDeliverables },
  { id: "crm", grp: "Company", title: "CRM", ic: "❏", desc: "Contacts & companies", flag: "manual", render: renderCrm },
  { id: "pipeline", grp: "Company", title: "Pipeline", ic: "▩", desc: "Every deal by stage — open and closed", flag: "manual", render: renderPipeline },
  { id: "deals", grp: "Company", title: "Deals", ic: "◇", desc: "Deal list — value, stage & probability", flag: "manual", render: renderDeals },
  { id: "proposals", grp: "Company", title: "Proposals", ic: "▭", desc: "Quotes out — draft, sent & accepted", flag: "manual", render: renderProposals },
  { id: "activities", grp: "Company", title: "Activities", ic: "➤", desc: "Calls, emails & meetings against each deal", flag: "manual", render: renderActivities },
  { id: "finance", grp: "Company", title: "Finance", ic: "$", desc: "Subscriptions birds-eye view", flag: "manual", render: renderFinance },
  { id: "research", grp: "Company", title: "Research", ic: "◈", desc: "Latest trending news", flag: "needs", render: renderResearch },
  { id: "posts", grp: "Marketing", title: "Content Calendar", ic: "▣", desc: "Social posts by production stage", flag: "manual", render: renderPosts },
  { id: "blogs", grp: "Marketing", title: "Upcoming Blogs", ic: "▦", desc: "Blog prep & publish schedule", flag: "manual", render: renderBlogs },
  { id: "creative", grp: "Marketing", title: "Creative", ic: "✎", desc: "Mood boards, ideas pipeline & production schedule", flag: "manual", render: renderCreative },
  { id: "campaigns", grp: "Marketing", title: "Campaigns", ic: "◐", desc: "Organic & offer campaigns — budget, window, target", flag: "manual", render: renderCampaigns },
  { id: "ads", grp: "Marketing", title: "Ad Campaigns", ic: "◉", desc: "Paid performance by channel — spend, CTR, CPA, ROAS", flag: "manual", render: renderAds },
  { id: "prospects", grp: "Marketing", title: "Prospects", ic: "⊙", desc: "Target accounts before they become leads", flag: "manual", render: renderProspects },
  { id: "leads", grp: "Marketing", title: "Leads", ic: "◎", desc: "Sourced contacts and where each one sits", flag: "needs", render: renderLeads },
  { id: "email-campaigns", grp: "Marketing", title: "Email Campaigns", ic: "✉", desc: "Instantly & A-leads sequences", flag: "needs", render: renderEmailCampaigns },
  { id: "templates", grp: "Marketing", title: "Templates", ic: "▤", desc: "Sequence copy — one card per step", flag: "manual", render: renderTemplates },
  { id: "analytics", grp: "Marketing", title: "Analytics", ic: "◭", desc: "Weekly snapshots across channels", flag: "manual", render: renderAnalytics },
  { id: "apis", grp: "System", title: "APIs & MCPs", ic: "⌁", desc: "Every API and MCP available to the agents", flag: "live", render: renderApis },
  { id: "skills", grp: "System", title: "Skills", ic: "✦", desc: "All installed skills by area", flag: "live", render: renderSkills },
  { id: "planner", grp: "System", title: "Workflow Planner", ic: "⟐", desc: "Compose a workflow from skills + APIs", flag: "live", render: renderPlanner },
  { id: "multica", grp: "System", title: "Multica", ic: "◆", desc: "Workspace activity — tasks, projects & agents", flag: "needs", render: renderMultica },
];

const FLAG_LABEL = { live: "Live", manual: "Manual data", needs: "Needs credential" };
const BRIEF_TYPES = [
  ["all", "All"],
  ["morning", "Morning"],
  ["eod", "EOD"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Qtr"],
  ["yearly", "Yr"],
];
const BRIEF_META = {
  morning: { label: "Morning", badge: "lime", wins: "Overnight - what shipped", next: "Top 3 - stay ahead today" },
  eod: { label: "EOD", badge: "info", wins: "Today - what got done", next: "Top 3 - for tomorrow" },
  weekly: { label: "Weekly", badge: "ok", wins: "Wins this week", next: "Top 3 - next week" },
  monthly: { label: "Monthly", badge: "warn", wins: "Wins this month", next: "Top 3 - next month" },
  quarterly: { label: "Quarterly", badge: "dark", wins: "Wins this quarter", next: "Top 3 - next quarter" },
  yearly: { label: "Yearly", badge: "dark", wins: "Wins this year", next: "Top 3 - next year" },
};
const briefMeta = (type) => BRIEF_META[type] || { label: esc(type || "Brief"), badge: "", wins: "Wins", next: "Top 3" };
const briefTime = (s, opts = {}) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", ...opts }).format(d);
};
const sortedBriefs = () => [...BRIEFS].sort((a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || "")));
const briefPreview = (b) => (b.wins?.[0] || b.next3?.[0] || b.industry_pulse?.[0] || "Open brief");

// ---- Section renderers ----
function renderOverview() {
  const d = DATA;
  const projCount = (d.projects?.clients?.length || 0) + (d.projects?.internal?.length || 0);
  const monthly = (d.finance?.subscriptions || []).reduce((s, x) => s + (x.cycle === "annual" ? x.monthly / 12 : x.monthly), 0);
  const blogCount = (blogsData().cards || []).length;
  const outboundCount = hasLiveLeads() ? (leadsData().summary?.projects || 0) : (d.outbound?.leads || []).length;
  const openTodos = (d.todos || []).filter((t) => !t.done).length;
  const open = openDeals();
  const postsQueued = (MARKETING.posts?.cards || []).filter((c) => c.col !== "Published").length;
  return `
  <div class="grid g4">
    ${statCard("Active projects", projCount, "clients + internal")}
    ${statCard("Open to-dos", openTodos, "across the board")}
    ${statCard("Open pipeline", money(total(open), salesCur()), open.length ? `${open.length} live deals` : "no deals recorded")}
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
      ${snap("CRM", `${crmRows("contacts").length} contacts · ${crmRows("companies").length} companies`, "crm")}
      ${snap("Pipeline", `${money(weighted(open), salesCur())} weighted`, "pipeline")}
      ${snap("Proposals", `${(d.sales?.proposals || []).length} out`, "proposals")}
      ${snap("Outbound", outboundCount + (hasLiveLeads() ? " projects" : " leads"), "leads")}
      ${snap("Deliverables", `${dvClients().filter((c) => c.kind === "active").length} active · ${dvClients().filter((c) => c.kind === "potential").length} in pipeline`, "deliverables")}
      ${snap("Blogs", blogCount + " cards", "blogs")}
      ${snap("Content calendar", postsQueued + " posts queued", "posts")}
      ${snap("Finance", money(monthly) + "/mo", "finance")}
      ${snap("APIs / MCPs", APIS.filter((a) => a.status === "connected").length + " connected", "apis")}
      ${snap("Skills", Object.values(SKILLS).flat().length + " installed", "skills")}
    </div>
  </div>`;
}
const statCard = (label, val, sub) => `<div class="card"><div class="muted tiny">${esc(label)}</div><div class="stat" style="margin-top:6px">${val}</div><div class="muted tiny" style="margin-top:4px">${esc(sub)}</div></div>`;
const snap = (t, v, go) => `<div class="card" style="cursor:pointer;box-shadow:none" data-go="${go}"><div style="font-weight:600">${esc(t)}</div><div class="muted tiny" style="margin-top:4px">${esc(v)} →</div></div>`;

function renderBriefs(route = []) {
  const id = route[0];
  if (id) return renderBriefRead(id);
  const briefs = sortedBriefs();
  setTimeout(wireBriefs, 0);
  if (!briefs.length) return `<div class="card"><h3>Briefs</h3><p class="muted">No generated briefs yet.</p></div>`;
  let lastDay = "";
  const rows = briefs.map((b) => {
    const m = briefMeta(b.type);
    const day = briefTime(b.generated_at, { year: "numeric", hour: undefined, minute: undefined });
    const divider = day !== lastDay ? `<div class="brief-date">${esc(day)}</div>` : "";
    lastDay = day;
    return `${divider}<button class="row brief-row" data-brief-id="${esc(b.id)}" data-type="${esc(b.type)}">
      <span class="brief-dot ${b.read ? "read" : ""}"></span>
      <span class="brief-main"><span class="name">${esc(b.period_label || day)}</span><span class="muted tiny">${esc(clip(briefPreview(b), 96))}</span></span>
      <span class="badge ${m.badge}">${esc(m.label)}</span><span class="meta">›</span>
    </button>`;
  }).join("");
  return `<div class="tabs" id="briefTabs">${BRIEF_TYPES.map(([type, label]) => `<button class="tab ${type === "all" ? "active" : ""}" data-type="${type}">${label}</button>`).join("")}</div>
  <div class="card"><h3>Briefs <span class="pill">${briefs.length}</span></h3><div class="rowlist">${rows}</div></div>`;
}

function renderBriefCard(title, items) {
  return `<div class="card"><h3>${esc(title)}</h3>${(items || []).length
    ? `<ol>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`
    : '<p class="muted">No source items found.</p>'}</div>`;
}

function renderBriefRead(id) {
  const briefs = sortedBriefs();
  const idx = briefs.findIndex((b) => b.id === id);
  const b = briefs[idx];
  setTimeout(wireBriefs, 0);
  if (!b) return `<div class="card"><button class="btn ghost" data-go="briefs">‹ Back</button><p class="muted" style="margin-top:14px">Brief not found.</p></div>`;
  const m = briefMeta(b.type);
  const prev = briefs[idx + 1], next = briefs[idx - 1];
  return `<div class="brief-head">
    <button class="btn ghost" data-go="briefs">‹ Back</button>
    <div><span class="badge ${m.badge}">${esc(m.label)}</span><span class="muted tiny" style="margin-left:8px">${esc(briefTime(b.generated_at))}</span></div>
  </div>
  <div class="grid" style="gap:14px">
    ${renderBriefCard(m.wins, b.wins)}
    ${renderBriefCard(m.next, b.next3)}
    ${(b.industry_pulse || []).length ? renderBriefCard("Industry pulse", b.industry_pulse) : ""}
  </div>
  <div class="briefs-nav">
    <button class="btn ghost" ${prev ? `data-brief-id="${esc(prev.id)}"` : "disabled"}>‹ Prev brief</button>
    <span class="muted tiny">${esc(b.period_label || m.label)}</span>
    <button class="btn ghost" ${next ? `data-brief-id="${esc(next.id)}"` : "disabled"}>Next ›</button>
  </div>`;
}

function wireBriefs() {
  const tabs = $("#briefTabs");
  if (tabs) tabs.onclick = (e) => {
    const btn = e.target.closest(".tab"); if (!btn) return;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
    const type = btn.dataset.type;
    document.querySelectorAll(".brief-row").forEach((r) => r.hidden = type !== "all" && r.dataset.type !== type);
    document.querySelectorAll(".brief-date").forEach((d) => {
      let n = d.nextElementSibling, any = false;
      while (n && !n.classList.contains("brief-date")) { if (!n.hidden) any = true; n = n.nextElementSibling; }
      d.hidden = !any;
    });
  };
  document.querySelectorAll("[data-brief-id]").forEach((el) => {
    el.onclick = () => go("briefs/" + el.dataset.briefId);
  });
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

// ---- CRM (contacts + companies) ----
// Seed rows come from data/board.json (crm.contacts / crm.companies). Rows added in the
// UI live in this browser only (localStorage) — there is no CRM store behind the Worker yet.
const CRM_KINDS = [["contacts", "Contacts"], ["companies", "Companies"]];
const CRM_FIELDS = {
  contacts: [["name", "Name"], ["role", "Role"], ["company", "Company"], ["email", "Email"], ["status", "Status"]],
  companies: [["name", "Name"], ["industry", "Industry"], ["country", "Country"], ["website", "Website"]],
};
const CRM_STATUS = { customer: "ok", client: "ok", active: "ok", qualified: "lime", prospect: "info", lead: "info", churned: "bad", cold: "" };
let CRM_TAB = "contacts";

const crmLocal = () => { try { return JSON.parse(localStorage.getItem("mc_crm") || "{}"); } catch { return {}; } };
const crmSaveLocal = (store) => localStorage.setItem("mc_crm", JSON.stringify(store));
const crmRows = (kind) => [
  ...((DATA.crm || {})[kind] || []),
  ...((crmLocal()[kind] || []).map((r, i) => ({ ...r, _local: i }))),
];
const crmCell = (kind, row, key) => {
  const v = row[key];
  if (!v) return '<span class="muted">—</span>';
  if (key === "name") return `<b>${esc(v)}</b>`;
  if (key === "website") return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v.replace(/^https?:\/\//, ""))}</a>`;
  if (key === "email") return `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
  if (key === "status") return `<span class="badge ${CRM_STATUS[String(v).toLowerCase()] || ""}">${esc(v)}</span>`;
  return esc(v);
};
// RFC 4180: quote every field, double any embedded quote. Excel-safe on commas + newlines.
function crmCsv(kind) {
  const fields = CRM_FIELDS[kind];
  const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  return [fields.map(([, label]) => cell(label)).join(","),
    ...crmRows(kind).map((r) => fields.map(([k]) => cell(r[k])).join(","))].join("\r\n");
}

function renderCrmTable(kind) {
  const fields = CRM_FIELDS[kind];
  const rows = crmRows(kind);
  const label = CRM_KINDS.find(([k]) => k === kind)[1];
  const single = label.replace(/ies$/, "y").replace(/s$/, "");
  const body = rows.length ? rows.map((r) => `
    <tr data-find="${esc(fields.map(([k]) => r[k] || "").join(" ").toLowerCase())}">
      ${fields.map(([k]) => `<td>${crmCell(kind, r, k)}</td>`).join("")}
      <td style="text-align:right">${r._local == null ? "" : `<button class="lnk" data-del="${r._local}" data-kind="${kind}" title="Remove this locally-added row">×</button>`}</td>
    </tr>`).join("") : `<tr><td colspan="${fields.length + 1}" class="muted">No ${label.toLowerCase()} yet.</td></tr>`;
  return `<div class="card">
    <h3>${esc(label)} <span class="pill">${rows.length}</span></h3>
    <div class="crm-tools">
      <input class="inp" data-search="${kind}" placeholder="Search ${label.toLowerCase()}…" aria-label="Search ${esc(label.toLowerCase())}">
      <span class="muted tiny" data-shown="${kind}">${rows.length} shown</span>
      <button class="btn ghost" data-export="${kind}" disabled title="Export is off until the outbound suppression filter lands (WEB-680) — a CSV must not be able to carry a suppressed contact out of the board.">↓ Export CSV</button>
      <button class="btn primary" data-new="${kind}">+ New ${esc(single.toLowerCase())}</button>
    </div>
    <form class="crm-form" data-form="${kind}" hidden>
      ${fields.map(([k, l]) => `<label>${esc(l)}<input class="inp" name="${k}" ${k === "name" ? "required" : ""} ${k === "email" ? 'type="email"' : ""}></label>`).join("")}
      <div class="crm-form-act"><button class="btn primary" type="submit">Add</button><button class="btn ghost" type="button" data-cancel="${kind}">Cancel</button></div>
    </form>
    <table><thead><tr>${fields.map(([, l]) => `<th>${esc(l)}</th>`).join("")}<th></th></tr></thead><tbody>${body}</tbody></table>
  </div>`;
}

function renderCrm(route = []) {
  if (CRM_FIELDS[route[0]]) CRM_TAB = route[0];
  setTimeout(wireCrm, 0);
  return `<div class="section-note"><b>Manual data:</b> seed rows live in <code>data/board.json</code>. Rows you add here are saved in this browser only — a shared CRM store needs a database behind the Worker.</div>
  <div class="tabs" id="crmTabs">${CRM_KINDS.map(([k, l]) => `<button class="tab ${k === CRM_TAB ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
  ${CRM_KINDS.map(([k]) => `<div class="tabpage ${k === CRM_TAB ? "active" : ""}" id="crm-${k}">${renderCrmTable(k)}</div>`).join("")}`;
}

function wireCrm() {
  const tabs = $("#crmTabs"); if (!tabs) return;
  tabs.onclick = (e) => { const b = e.target.closest(".tab"); if (b) go("crm/" + b.dataset.tab); };
  document.querySelectorAll("[data-search]").forEach((inp) => {
    inp.oninput = () => {
      const kind = inp.dataset.search, q = inp.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll(`#crm-${kind} tbody tr[data-find]`).forEach((tr) => {
        const hit = !q || tr.dataset.find.includes(q);
        tr.hidden = !hit; if (hit) shown++;
      });
      $(`[data-shown="${kind}"]`).textContent = shown + " shown";
    };
  });
  document.querySelectorAll("[data-export]").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.export;
      const url = URL.createObjectURL(new Blob([crmCsv(kind)], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `webuild-${kind}.csv` });
      a.click(); URL.revokeObjectURL(url);
    };
  });
  document.querySelectorAll("[data-new]").forEach((btn) => {
    btn.onclick = () => { const f = $(`[data-form="${btn.dataset.new}"]`); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("input").focus(); };
  });
  document.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.onclick = () => { $(`[data-form="${btn.dataset.cancel}"]`).hidden = true; };
  });
  document.querySelectorAll("[data-form]").forEach((form) => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const kind = form.dataset.form;
      const row = {};
      CRM_FIELDS[kind].forEach(([k]) => { const v = form.elements[k].value.trim(); if (v) row[k] = v; });
      if (!row.name) return;
      const store = crmLocal();
      store[kind] = [...(store[kind] || []), row];
      crmSaveLocal(store);
      go("crm/" + kind);
    };
  });
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.kind, store = crmLocal();
      (store[kind] || []).splice(+btn.dataset.del, 1);
      crmSaveLocal(store);
      go("crm/" + kind);
    };
  });
}

// ---- Sales (pipeline / deals / proposals / activities) ----
// ponytail: every total here sums raw `value` in one currency (sales.currency).
// Add per-deal FX conversion the day a deal is priced in something else.
const SALES_STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Won"];
const CLOSED = ["Won", "Lost"];
const salesData = () => DATA.sales || {};
const outboundData = () => DATA.outbound || {};
const salesCur = () => salesData().currency || "AUD";
const deals = () => salesData().deals || [];
const openDeals = () => deals().filter((d) => !CLOSED.includes(d.stage));
const weighted = (list) => list.reduce((s, d) => s + (+d.value || 0) * (+d.probability || 0) / 100, 0);
const total = (list) => list.reduce((s, d) => s + (+d.value || 0), 0);
const STAGE_CLS = { Won: "ok", Lost: "bad", Negotiation: "lime", Proposal: "info", Qualified: "warn", Lead: "" };
const stagePill = (s) => `<span class="badge ${STAGE_CLS[s] || ""}">${esc(s || "—")}</span>`;
// Same marker as deliverables.json / PR #67: a row that is not a real record says so on its face.
const demoBadge = (r) => (r && r.demo ? ' <span class="badge">demo</span>' : "");
// WEB-660: the pipeline is empty on purpose. A dashboard that invents its own
// revenue is worse than one showing nothing, so say why rather than look broken.
const EMPTY_SALES = "No deals recorded. The seed deals that shipped in this section were invented and have been removed (WEB-660) — every number here stays at zero until a real, agreed deal is entered in data/board.json.";

function renderPipeline() {
  const all = deals(), open = openDeals();
  // Columns come from the known stages plus anything unexpected in the data, so
  // a typo'd stage shows up as its own column instead of silently vanishing.
  const cols = [...new Set([...SALES_STAGES, ...all.map((d) => d.stage)])];
  return note(all.length ? "Deals come from data/board.json — replace with a CRM feed when there is one." : EMPTY_SALES) +
  `<div class="grid g4">
    ${statCard("Open deals", open.length, "not won or lost")}
    ${statCard("Pipeline value", money(total(open), salesCur()), "sum of open deals")}
    ${statCard("Weighted", money(weighted(open), salesCur()), "value × probability")}
    ${statCard("Won", money(total(all.filter((d) => d.stage === "Won")), salesCur()), "closed to date")}
  </div>
  <div class="kan kan5" style="margin-top:16px">${cols.map((col) => {
    const items = all.filter((d) => d.stage === col);
    return `<div class="col"><h4>${esc(col)}<span>${items.length}</span></h4>${items.map((d) => `
      <div class="item"><div class="t">${esc(clip(d.title, 46))}</div>
        <div class="m">${esc(d.company || "—")} · ${esc(d.owner || "Unassigned")}</div>
        <div class="m"><b>${money(d.value || 0, salesCur())}</b> · ${esc(d.probability ?? 0)}%</div>
      </div>`).join("") || '<p class="muted tiny">—</p>'}</div>`;
  }).join("")}</div>`;
}

function renderDeals() {
  const rows = deals();
  return note(rows.length ? "Deals come from data/board.json." : EMPTY_SALES) +
  `<div class="card"><h3>Deals <span class="pill">${rows.length}</span></h3>
    <table><thead><tr><th>Title</th><th>Company</th><th>Stage</th><th>Value</th><th>Probability</th><th>Close</th></tr></thead><tbody>${rows.map((d) => `
    <tr><td><b>${esc(d.title)}</b></td><td class="muted">${esc(d.company || "—")}</td><td>${stagePill(d.stage)}</td>
    <td><b>${money(d.value || 0, salesCur())}</b></td>
    <td><div class="bar"><span style="width:${Math.max(0, Math.min(100, +d.probability || 0))}%"></span></div><span class="tiny muted">${esc(d.probability ?? 0)}%</span></td>
    <td class="muted">${esc(d.close || "—")}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">No deals.</td></tr>'}</tbody></table></div>`;
}

const PROPOSAL_CLS = { accepted: "ok", sent: "info", draft: "", declined: "bad" };
function renderProposals() {
  const rows = salesData().proposals || [];
  if (!rows.length) return note(EMPTY_SALES) + `<div class="card"><p class="muted">No proposals out.</p></div>`;
  return `<div class="grid g3">${rows.map((p) => `
    <div class="card"><h3>${esc(p.title)} <span class="badge ${PROPOSAL_CLS[p.status] || ""}">${esc(p.status || "—")}</span></h3>
      <p class="muted tiny" style="margin-top:-8px">${esc(p.client || "")}</p>
      <div class="mini"><div><b>${money(p.value || 0, salesCur())}</b><span>Value</span></div>
        <div><b>${esc(p.items ?? 0)}</b><span>Items</span></div>
        <div><b>${esc(p.valid || "—")}</b><span>Valid to</span></div></div>
    </div>`).join("")}</div>`;
}

const ACT_CLS = { call: "lime", meeting: "info", email: "", linkedin: "warn" };
function renderActivities() {
  const rows = [...(salesData().activities || [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return (rows.length ? "" : note(EMPTY_SALES)) +
  `<div class="card"><h3>Activities <span class="pill">${rows.length}</span></h3>
    <table><thead><tr><th>Date</th><th>Type</th><th>Summary</th><th>Contact</th></tr></thead><tbody>${rows.map((a) => `
    <tr><td class="muted">${esc(a.date || "—")}</td><td><span class="badge ${ACT_CLS[a.type] || ""}">${esc(a.type || "—")}</span></td>
    <td><b>${esc(a.summary)}</b></td><td class="muted">${esc(a.contact || "—")}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">Nothing logged.</td></tr>'}</tbody></table></div>`;
}

// ---- Outbound (prospects / leads / campaigns / templates) ----
// WEB-660: nothing in Outbound is a real contact or a real result. Rows carry
// `demo: true` in board.json and render the demo badge so the page cannot be
// misread as live outbound.
// note() escapes its argument, so this stays plain text — the badge on each row is the visible marker.
const DEMO_NOTE = "Every row tagged demo is an illustrative target segment, not a real contact or a real result.";
const FIT_CLS = { high: "ok", medium: "warn", low: "" };
const LEAD_CLS = { qualified: "ok", replied: "lime", contacted: "info", new: "", bounced: "bad" };

function renderProspects() {
  const rows = outboundData().prospects || [];
  return note(DEMO_NOTE + " Promote one to Leads once there is a named contact.") +
  `<div class="card"><h3>Target accounts <span class="pill">${rows.length}</span></h3>
    <table><thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Size</th><th>Fit</th><th>Source</th></tr></thead><tbody>${rows.map((p) => `
    <tr><td><b>${esc(p.company)}</b>${demoBadge(p)}</td><td class="muted">${esc(p.industry || "—")}</td><td class="muted">${esc(p.location || "—")}</td>
    <td class="muted">${esc(p.size || "—")}</td><td><span class="badge ${FIT_CLS[p.fit] || ""}">${esc(p.fit || "—")}</span></td>
    <td><span class="badge dark">${esc(p.source || "—")}</span></td></tr>`).join("") || '<tr><td colspan="6" class="muted">No prospects.</td></tr>'}</tbody></table></div>`;
}

// WEB-680: PR #66 and PR #68 both shipped a `renderCampaigns` / `campaigns` section.
// Marketing keeps the plain name (board default #3 — #68's taxonomy wins); the outbound
// sequences are Email Campaigns, id `email-campaigns`.
function renderEmailCampaigns() {
  const rows = outboundData().campaigns || [];
  const pct = (n, d) => d ? Math.round(n / d * 100) + "%" : "0%";
  if (!rows.length) return `<div class="card"><p class="muted">No campaigns.</p></div>`;
  return note("Instantly and A-leads keys are not wired yet — counters stay at 0 until they are. " + DEMO_NOTE) +
  `<div class="grid g3">${rows.map((c) => `
    <div class="card"><h3>${esc(c.name)}${demoBadge(c)} <span class="badge ${c.status === "needs-key" ? "bad" : statusCls(c.status) || ""}">${esc(c.status || "—")}</span></h3>
      <p class="muted tiny" style="margin-top:-8px">${esc(c.tool || "")}${c.goal ? " · " + esc(c.goal) : ""}</p>
      <div class="mini"><div><b>${esc(c.sent ?? 0)}</b><span>Sent</span></div>
        <div><b>${pct(c.opened || 0, c.sent || 0)}</b><span>Opened</span></div>
        <div><b>${pct(c.replied || 0, c.sent || 0)}</b><span>Replied</span></div></div>
    </div>`).join("")}</div>`;
}

function renderTemplates() {
  const rows = outboundData().templates || [];
  if (!rows.length) return `<div class="card"><p class="muted">No templates.</p></div>`;
  return note("Draft sequence copy, not sending anywhere yet. " + DEMO_NOTE) +
  `<div class="grid g2">${rows.map((t) => `
    <div class="card"><h3>${esc(t.name)}${demoBadge(t)} <span class="badge ${t.channel === "linkedin" ? "info" : "lime"}">${esc(t.channel || "email")}</span><span class="pill">Step ${esc(t.step ?? 1)}</span></h3>
      <div class="kv"><span class="k">Subject</span><span class="v">${esc(t.subject || "—")}</span></div>
      <p class="muted tiny" style="margin-top:10px">${esc(t.body || "")}</p>
    </div>`).join("")}</div>`;
}

// ---- Deliverables — client work & progress, from data/deliverables.json ----
const DELIV_TABS = [["clients", "Clients"], ["projects", "Projects"], ["tasks", "Tasks"], ["time", "Time"], ["deploys", "Deployments"], ["portal", "Client portal"]];
const dvClients = () => DELIV.clients || [];
const dvClient = (id) => dvClients().find((c) => c.id === id);
const dvName = (id) => dvClient(id)?.name || (id === "webuild" ? "WeBuild (internal)" : id || "—");
const dvCur = () => DELIV.currency || "AUD";
const dvDemo = (c) => (c && c.demo ? ' <span class="badge">demo</span>' : "");
const PRIO = { urgent: "bad", high: "warn", medium: "info", low: "" };
const INV = { paid: "ok", sent: "info", overdue: "bad", draft: "" };
const APPR = { approved: "ok", awaiting: "warn", changes: "bad" };
const dvBar = (pct) => `<div class="bar"><span style="width:${Math.max(0, Math.min(100, +pct || 0))}%"></span></div><span class="tiny muted">${Math.round(+pct || 0)}%</span>`;

function renderDeliverables(route = []) {
  const tab = DELIV_TABS.some(([id]) => id === route[0]) ? route[0] : "clients";
  const cs = dvClients();
  const pipeline = cs.filter((c) => c.kind === "potential");
  const active = cs.filter((c) => c.kind === "active");
  const tasks = DELIV.tasks || [];
  const entries = DELIV.time?.entries || [];
  const billable = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours * (e.rate || 0), 0);
  setTimeout(wireDeliverables, 0);
  const pages = {
    clients: renderDvClients,
    projects: renderDvProjects,
    tasks: renderDvTasks,
    time: renderDvTime,
    deploys: renderDvDeploys,
    portal: renderDvPortal,
  };
  return `<div class="section-note">Rows tagged <span class="badge">demo</span> are WeBuild's own sample clients — illustrative numbers, not real engagements. <b>Optora</b> and <b>Awqaf</b> are real pipeline entries, prefilled from the work already done with them.</div>
  <div class="grid g4">
    ${statCard("Active clients", active.length, "in delivery")}
    ${statCard("In pipeline", pipeline.length, "potential clients")}
    ${statCard("Open tasks", tasks.filter((t) => t.col !== "Done").length, "across all projects")}
    ${statCard("Billable this month", money(billable, dvCur()), "logged hours × rate")}
  </div>
  <div class="tabs" id="dvTabs" style="margin-top:16px">${DELIV_TABS.map(([id, label]) => `<button class="tab ${id === tab ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}</div>
  <div id="dvPages"><div class="tabpage active" id="dv-${tab}">${pages[tab]()}</div></div>`;
}

function renderDvClients() {
  const cs = dvClients();
  const pipeline = cs.filter((c) => c.kind === "potential");
  const rest = cs.filter((c) => c.kind !== "potential");
  const value = (c) => [c.build_value ? money(c.build_value, dvCur()) + " build" : null, c.retainer ? money(c.retainer, dvCur()) + "/mo" : null].filter(Boolean).join(" · ") || "TBC";
  const list = (title, items) => (items || []).length ? `<div style="margin-top:10px"><div class="muted tiny" style="font-weight:600">${esc(title)}</div><ul style="margin:6px 0 0 18px;font-size:13px">${items.map((x) => `<li style="margin-bottom:4px">${esc(x)}</li>`).join("")}</ul></div>` : "";
  const cards = pipeline.map((c) => `<div class="card">
    <h3>${esc(c.name)} <span class="badge ${HEALTH[c.health] || ""}">${esc(c.stage)}</span></h3>
    <p class="muted tiny" style="margin-top:-8px">${esc(c.engagement)}</p>
    <div class="kv"><span class="k">Value</span><span class="v">${esc(value(c))}</span></div>
    <div class="kv"><span class="k">Contacts</span><span class="v tiny">${esc(c.contacts || "—")}</span></div>
    <div class="kv"><span class="k">Profile</span><span class="v tiny">${esc(c.profile || "—")}</span></div>
    ${list("Delivered so far", c.delivered)}
    ${list("Blockers", c.blockers)}
    <div class="kv" style="margin-top:10px"><span class="k"><b>Next step</b></span><span class="v tiny">${esc(c.next_step || "—")}</span></div>
    ${(c.refs || []).length ? `<div class="chips" style="margin-top:10px">${c.refs.map((r) => `<span class="chip">${esc(r)}</span>`).join("")}</div>` : ""}
  </div>`).join("") || '<div class="card"><p class="muted">No potential clients in the pipeline.</p></div>';
  return `<div class="card"><h3>Pipeline — potential clients <span class="pill">${pipeline.length}</span></h3><p class="muted tiny" style="margin-top:-6px">Real engagements. Everything below is what has actually been delivered and what is blocking each one.</p></div>
  <div class="grid g2" style="margin-top:16px">${cards}</div>
  <div class="card" style="margin-top:16px"><h3>Clients</h3><table><thead><tr><th>Client</th><th>Engagement</th><th>Stage</th><th>Owner</th><th>Value</th></tr></thead><tbody>${rest.map((c) => `
    <tr><td><b>${esc(c.name)}</b>${dvDemo(c)}<div class="tiny muted">${esc(c.profile || "")}</div></td>
    <td class="muted">${esc(c.engagement)}</td>
    <td><span class="badge ${HEALTH[c.health] || ""}">${esc(c.stage)}</span></td>
    <td class="muted">${esc(c.owner || "—")}</td>
    <td>${esc(value(c))}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">No clients yet.</td></tr>'}</tbody></table></div>`;
}

function renderDvProjects() {
  const rows = (DELIV.projects || []).map((p) => {
    const c = dvClient(p.client);
    return `<tr><td><b>${esc(p.name)}</b><div class="tiny muted">${esc(dvName(p.client))}${c && c.demo ? " · demo" : ""}</div></td>
    <td><span class="badge ${HEALTH[p.health] || statusCls(p.status)}">${esc(p.stage)}</span></td>
    <td>${dvBar(p.progress)}</td>
    <td class="muted">${esc(p.due || "—")}</td>
    <td>${p.value ? money(p.value, dvCur()) : "—"}</td></tr>`;
  }).join("") || '<tr><td colspan="5" class="muted">No projects yet.</td></tr>';
  return `<div class="card"><h3>Delivery projects</h3><table><thead><tr><th>Project</th><th>Stage</th><th style="width:160px">Progress</th><th>Due</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDvTasks() {
  const cols = DELIV.task_columns || ["Todo", "In progress", "Blocked", "Done"];
  const tasks = DELIV.tasks || [];
  return `<div class="kan">${cols.map((col) => {
    const items = tasks.filter((t) => t.col === col);
    return `<div class="col"><h4>${esc(col)}<span>${items.length}</span></h4>${items.map((t) => `
      <div class="item"><div class="t">${esc(t.title)}</div>
        <div class="m">${esc(dvName(t.client))}${t.project ? " · " + esc(clip(t.project, 34)) : ""}</div>
        <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span class="badge ${PRIO[t.priority] ?? ""}">${esc(t.priority || "—")}</span>
          <span class="tiny muted">${esc(t.owner || "Unassigned")}${t.due ? " · " + esc(t.due) : ""}</span>
        </div></div>`).join("") || '<p class="muted tiny">—</p>'}</div>`;
  }).join("")}</div>`;
}

function renderDvTime() {
  const t = DELIV.time || { entries: [], retainers: [] };
  const entries = t.entries || [];
  const hours = entries.reduce((s, e) => s + (+e.hours || 0), 0);
  const billableHours = entries.filter((e) => e.billable).reduce((s, e) => s + (+e.hours || 0), 0);
  const value = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours * (e.rate || 0), 0);
  const cost = entries.reduce((s, e) => s + (+e.cost || 0), 0);
  return `${t.note ? `<div class="section-note">${esc(t.note)}</div>` : ""}
  <div class="grid g4">
    ${statCard("Hours logged", hours.toFixed(1), billableHours.toFixed(1) + " billable")}
    ${statCard("Billable value", money(value, dvCur()), "at client rates")}
    ${statCard("Est. cost", money(cost, dvCur()), "compute + tooling")}
    ${statCard("Est. margin", money(value - cost, dvCur()), "value − cost")}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Retainer burn · ${esc(t.month || "this month")}</h3>${(t.retainers || []).map((r) => `
      <div style="margin-bottom:12px"><div class="kv"><span class="k">${esc(dvName(r.client))}</span><span class="v tiny">${r.hours_used}h / ${r.hours_included}h</span></div>
      ${dvBar(r.hours_included ? (r.hours_used / r.hours_included) * 100 : 0)}</div>`).join("") || '<p class="muted">No retainers.</p>'}</div>
    <div class="card"><h3>Recent entries</h3><table><thead><tr><th>Date</th><th>Project</th><th>Who</th><th>Hours</th></tr></thead><tbody>${entries.map((e) => `
      <tr><td class="muted">${esc(e.date)}</td><td>${esc(clip(e.project || dvName(e.client), 38))}<div class="tiny muted">${esc(dvName(e.client))}</div></td>
      <td class="muted">${esc(e.who || "—")}</td><td><b>${(+e.hours).toFixed(1)}h</b>${e.billable ? "" : ' <span class="tiny muted">nb</span>'}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">Nothing logged.</td></tr>'}</tbody></table></div>
  </div>`;
}

function renderDvDeploys() {
  const all = DELIV.deployments || [];
  const groups = [...new Set(all.map((d) => d.client))];
  const envCls = { live: "ok", staging: "warn", demo: "info" };
  return `<div class="card"><h3>Live deployments <span class="pill">${all.length}</span></h3><p class="muted tiny" style="margin-top:-6px">Every site, app and dashboard we host — client-facing and internal.</p></div>
  ${groups.map((g) => {
    const rows = all.filter((d) => d.client === g);
    const c = dvClient(g);
    return `<div class="card" style="margin-top:16px"><h3>${esc(dvName(g))}${dvDemo(c)} <span class="badge">${rows.length}</span></h3><div class="rowlist">${rows.map((d) => `
      <div class="row"><span class="name">${esc(d.name)}${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener" style="display:block;font-size:12px;color:var(--info);font-weight:600">${esc(d.url.replace(/^https?:\/\//, ""))} ↗</a>` : '<span class="tiny muted" style="display:block">not deployed</span>'}</span>
      <span class="badge ${envCls[d.env] || ""}">${esc(d.env)}</span><span class="meta">${esc(d.audience)}</span></div>`).join("")}</div></div>`;
  }).join("")}`;
}

function renderDvPortal(id) {
  const cs = dvClients();
  const cur = cs.find((c) => c.id === id) || cs[0];
  if (!cur) return `<div class="card"><p class="muted">No clients yet.</p></div>`;
  const p = DELIV.portal || {};
  const projects = (DELIV.projects || []).filter((x) => x.client === cur.id);
  const approvals = (p.approvals || []).filter((x) => x.client === cur.id);
  const invoices = (p.invoices || []).filter((x) => x.client === cur.id);
  return `<div class="card"><h3>Preview what ${esc(cur.name)} sees${dvDemo(cur)}</h3>
    <p class="muted tiny" style="margin-top:-6px">Status, approvals, invoices and the compliance promises we hold ourselves to.</p>
    <select id="dvPortalPick" style="margin-top:10px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;font-family:inherit">
      ${cs.map((c) => `<option value="${esc(c.id)}" ${c.id === cur.id ? "selected" : ""}>${esc(c.name)}${c.demo ? " (demo)" : ""}</option>`).join("")}
    </select></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Project progress</h3>${projects.map((x) => `
      <div style="margin-bottom:12px"><div class="kv"><span class="k">${esc(x.name)}</span><span class="v tiny">${esc(x.stage)}</span></div>${dvBar(x.progress)}</div>`).join("") || '<p class="muted">No projects.</p>'}</div>
    <div class="card"><h3>Approvals ${approvals.length ? `<span class="pill">${approvals.length}</span>` : ""}</h3>${approvals.map((a) => `
      <div class="kv"><span class="k">${esc(a.item)}<span class="tiny muted" style="display:block">${esc(clip(a.project || "", 42))} · ${esc(a.date)}</span></span>
      <span class="v"><span class="badge ${APPR[a.status] || ""}">${esc(a.status)}</span></span></div>`).join("") || '<p class="muted">Nothing awaiting review.</p>'}</div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Invoices</h3><table><tbody>${invoices.map((i) => `
      <tr><td class="muted">${esc(i.ref)}</td><td><b>${money(i.amount, dvCur())}</b></td><td><span class="badge ${INV[i.status] || ""}">${esc(i.status)}</span></td><td class="muted">${esc(i.date)}</td></tr>`).join("") || '<tr><td class="muted">No invoices.</td></tr>'}</tbody></table></div>
    <div class="card"><h3>Compliance</h3>${(p.compliance || []).map((x) => `
      <div class="kv"><span class="k">✓ ${esc(x)}</span></div>`).join("") || '<p class="muted">No checklist.</p>'}</div>
  </div>`;
}

function wireDeliverables() {
  const tabs = $("#dvTabs"), pages = $("#dvPages");
  if (!tabs || !pages) return;
  tabs.onclick = (e) => {
    const b = e.target.closest(".tab"); if (!b) return;
    go("deliverables/" + b.dataset.tab); // tab lives in the hash, so a tab is linkable
  };
  pages.onchange = (e) => {
    if (e.target.id !== "dvPortalPick") return;
    $("#dv-portal").innerHTML = renderDvPortal(e.target.value);
  };
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

  const leads = outboundData().leads || [];
  const count = (s) => leads.filter((x) => x.status === s).length;
  return note("Instantly and A-leads API keys are not wired yet. " + DEMO_NOTE + " Campaign metrics live under Email Campaigns.") +
  `<div class="grid g4">
    ${statCard("Leads", leads.length, "in the list")}
    ${statCard("Contacted", count("contacted") + count("replied") + count("qualified"), "reached at least once")}
    ${statCard("Replied", count("replied"), "answered a sequence")}
    ${statCard("Qualified", count("qualified"), "ready for a call")}
  </div>
  <div class="card" style="margin-top:16px"><h3>Leads</h3><table><thead><tr><th>Contact</th><th>Company</th><th>Title</th><th>Status</th><th>Source</th><th>Industry</th></tr></thead><tbody>${leads.map((x) => `
    <tr><td><b>${esc(x.name)}</b>${demoBadge(x)}</td><td>${esc(x.company || "—")}</td><td class="muted">${esc(x.title || "—")}</td>
    <td><span class="badge ${LEAD_CLS[x.status] || ""}">${esc(x.status || "—")}</span></td>
    <td><span class="badge dark">${esc(x.source || "—")}</span></td><td class="muted">${esc(x.industry || "—")}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">No leads.</td></tr>'}</tbody></table></div>`;
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

// ---- Marketing (content calendar · campaigns · ad campaigns · analytics) ----
// All four read data/marketing.json; the paid maths lives in marketing-metrics.js.
const mkNote = (t) => t ? `<div class="section-note">${esc(t)}</div>` : "";
const empty = (t) => `<div class="card"><p class="muted">${esc(t)}</p></div>`;
const curr = () => MARKETING.currency || "AUD";
const pct = (n) => (Math.round(n * 10) / 10) + "%";
const roas = (n) => (Math.round(n * 100) / 100) + "×";

function renderPosts() {
  const p = MARKETING.posts || {};
  const cols = p.columns || [];
  const cards = p.cards || [];
  if (!cols.length) return empty("No content calendar yet — add posts to data/marketing.json.");
  return mkNote(MARKETING._note) + `<div class="kan${cols.length > 4 ? " kan5" : ""}">${cols.map((col) => {
    const items = cards.filter((c) => c.col === col);
    return `<div class="col"><h4>${esc(col)}<span>${items.length}</span></h4>${items.map((c) => `
      <div class="item">
        <div class="t">${esc(c.title || "")}</div>
        <div class="m">${[c.channel, c.date, c.owner].filter(Boolean).map(esc).join(" · ")}</div>
      </div>`).join("") || '<p class="muted tiny">—</p>'}</div>`;
  }).join("")}</div>`;
}

function renderCampaigns() {
  const rows = MARKETING.campaigns || [];
  if (!rows.length) return empty("No campaigns yet — add them to data/marketing.json.");
  const live = rows.filter((c) => String(c.status || "").toLowerCase() === "active");
  const budget = rows.reduce((s, c) => s + (+c.budget || 0), 0);
  return mkNote(MARKETING._note) + `<div class="grid g3">
    ${statCard("Active", live.length, "running now")}
    ${statCard("Campaigns", rows.length, "all time")}
    ${statCard("Budget", money(budget, curr()), "committed across all")}
  </div>
  <div class="grid g2" style="margin-top:16px">${rows.map((c) => `
    <div class="card">
      <h3>${esc(c.name || "Untitled")} <span class="badge ${statusCls(c.status)}">${esc(c.status || "—")}</span></h3>
      <p class="muted tiny" style="margin-top:-8px">${esc(c.channels || "")}${c.goal ? " · " + esc(c.goal) : ""}</p>
      <div class="kv"><span class="k">Budget</span><span class="v">${money(+c.budget || 0, curr())}</span></div>
      <div class="kv"><span class="k">Window</span><span class="v">${esc(c.start || "—")} → ${esc(c.end || "—")}</span></div>
      <div class="kv"><span class="k">Target</span><span class="v">${esc(c.target || "—")}</span></div>
    </div>`).join("")}</div>`;
}

function renderAds() {
  const cfg = MARKETING.ads || {};
  const channels = cfg.channels || [];
  if (!channels.length) return empty("No ad channels configured — add them to data/marketing.json.");
  const blended = MarketingMetrics.blendedRollup(channels);
  const tabs = [...blended.channels.map((c) => [c.key, c.label]), ["analytics", "Analytics"]];
  setTimeout(() => wireTabs("adTabs", "ad-"), 0);
  return `<div class="tabs" id="adTabs">${tabs.map(([k, l], i) => `
    <button class="tab ${i ? "" : "active"}" data-tab="${esc(k)}">${esc(l)}</button>`).join("")}</div>
  ${mkNote(cfg._note || MARKETING._note)}
  ${blended.channels.map((ch, i) => `<div class="tabpage ${i ? "" : "active"}" id="ad-${esc(ch.key)}">${renderAdChannel(ch)}</div>`).join("")}
  <div class="tabpage" id="ad-analytics">${renderAdBlend(blended)}</div>`;
}

function renderAdChannel(ch) {
  const c = curr();
  return `<div class="grid g4">
    ${statCard("Spend", money(ch.spend, c), ch.count + " campaign" + (ch.count === 1 ? "" : "s"))}
    ${statCard("Conversions", ch.conversions, ch.conversions ? money(ch.cpa, c) + " CPA" : "no conversions yet")}
    ${statCard("Revenue", money(ch.revenue, c), "attributed")}
    ${statCard("ROAS", roas(ch.roas), "return on ad spend")}
  </div>
  <div class="card" style="margin-top:16px"><h3>${esc(ch.label)} campaigns <span class="badge">${ch.active} active</span></h3>
    <table><thead><tr><th>Campaign</th><th>Status</th><th>Spend</th><th>Conv</th><th>CTR</th><th>CPA</th><th>ROAS</th></tr></thead><tbody>${ch.campaigns.map((r) => `
      <tr><td><b>${esc(r.name || "Untitled")}</b>${r.objective ? `<div class="tiny muted">${esc(r.objective)}</div>` : ""}</td>
      <td><span class="badge ${statusCls(r.status)}">${esc(r.status || "—")}</span></td>
      <td>${money(r.spend, c)}</td><td>${r.conversions}</td><td>${pct(r.ctr)}</td>
      <td>${r.conversions ? money(r.cpa, c) : "—"}</td><td>${roas(r.roas)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderAdBlend(b) {
  const c = curr();
  const bar = (label, value, max, text) => `<div class="kv"><span class="k">${esc(label)}</span><span class="v" style="flex:1;text-align:left">
    <span class="bar" style="display:block"><span style="width:${max > 0 ? Math.round((value / max) * 100) : 0}%"></span></span></span><span class="v">${esc(text)}</span></div>`;
  const maxSpend = Math.max(...b.channels.map((ch) => ch.spend), 0);
  const maxRoas = Math.max(...b.channels.map((ch) => ch.roas), 0);
  return `<div class="grid g4">
    ${statCard("Total spend", money(b.spend, c), b.channels.length + " channels")}
    ${statCard("Total revenue", money(b.revenue, c), "attributed")}
    ${statCard("Conversions", b.conversions, b.conversions ? money(b.cpa, c) + " CPA" : "no conversions yet")}
    ${statCard("Blended ROAS", roas(b.roas), "across channels")}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Spend by channel</h3>${b.channels.map((ch) => bar(ch.label, ch.spend, maxSpend, money(ch.spend, c))).join("")}</div>
    <div class="card"><h3>ROAS by channel</h3>${b.channels.map((ch) => bar(ch.label, ch.roas, maxRoas, roas(ch.roas))).join("")}</div>
  </div>`;
}

function renderAnalytics() {
  const a = MARKETING.analytics || {};
  const rows = a.snapshots || [];
  if (!rows.length) return empty("No snapshots yet — add them to data/marketing.json.");
  const latest = MarketingMetrics.latestSnapshots(rows);
  const sorted = [...rows].sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
  const delta = (d) => d == null ? "" : `<span class="badge ${d < 0 ? "bad" : "ok"}">${d > 0 ? "+" : ""}${d}%</span>`;
  return mkNote(a._note || MARKETING._note) + `<div class="grid g4">${latest.map((m) => `
    <div class="card"><div class="muted tiny">${esc(m.source)}</div>
      <div class="stat small" style="margin-top:6px">${esc(String(m.value))} ${delta(m.delta)}</div>
      <div class="muted tiny" style="margin-top:4px">${esc(m.metric)} · ${esc(m.date || "")}</div></div>`).join("")}</div>
  <div class="card" style="margin-top:16px"><h3>All snapshots <span class="badge">${rows.length}</span></h3>
    <table><thead><tr><th>Date</th><th>Source</th><th>Metric</th><th>Value</th></tr></thead><tbody>${sorted.map((r) => `
      <tr><td class="muted">${esc(r.date || "—")}</td><td>${esc(r.source || "")}</td><td class="muted">${esc(r.metric || "")}</td><td><b>${esc(String(r.value))}</b></td></tr>`).join("")}</tbody></table></div>`;
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

// Shared by Creative and Ad Campaigns — pages are id'd `<prefix><tab>`.
function wireTabs(tabsId, prefix) {
  const tabs = document.getElementById(tabsId); if (!tabs) return;
  tabs.onclick = (e) => {
    const b = e.target.closest(".tab"); if (!b) return;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === b));
    document.querySelectorAll(`.tabpage[id^="${prefix}"]`).forEach((p) => p.classList.toggle("active", p.id === prefix + b.dataset.tab));
  };
}

function wireCreative() {
  wireTabs("crTabs", "cr-");
  const lb = $("#crLightbox"); if (!lb) return;
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
  const groups = [...new Set(SECTIONS.map((s) => s.grp || "Company"))];
  $("#nav").innerHTML = groups.map((g) => `<div class="grp">${esc(g)}</div>` +
    SECTIONS.filter((s) => (s.grp || "Company") === g).map((s) => `<a data-id="${s.id}"><span class="ic">${s.ic}</span>${s.title}</a>`).join("")).join("");
  $("#pages").innerHTML = SECTIONS.map((s) => `<section class="page" id="pg-${s.id}"></section>`).join("");
}
function go(raw = "overview") {
  const route = String(raw || "overview").replace(/^#?\/?/, "").split("/").filter(Boolean);
  const id = route[0] || "overview";
  const s = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.id === s.id));
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const pg = $("#pg-" + s.id);
  pg.innerHTML = s.render(s.id === id ? route.slice(1) : []);
  pg.classList.add("active");
  $("#ptitle").textContent = s.title;
  $("#pdesc").textContent = s.desc;
  const flag = $("#pflag");
  const pageFlag = (s.id === "multica" && DATA.multica?.live) || (s.id === "blogs" && hasLiveBlogs()) || (s.id === "leads" && hasLiveLeads()) ? "live" : s.flag;
  flag.className = "pill " + pageFlag;
  flag.textContent = FLAG_LABEL[pageFlag];
  $("#side").classList.remove("open");
  const nextHash = "/" + [s.id, ...(s.id === id ? route.slice(1) : [])].join("/");
  if (location.hash !== "#" + nextHash) location.hash = nextHash;
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
  try { MARKETING = await (await fetch("/mission-control/data/marketing.json", { cache: "no-store" })).json(); }
  catch { MARKETING = {}; }
  try { BRIEFS = await (await fetch("/mission-control/data/briefs.json", { cache: "no-store" })).json(); if (!Array.isArray(BRIEFS)) BRIEFS = []; }
  catch { BRIEFS = []; }
  try { DELIV = await (await fetch("/mission-control/data/deliverables.json", { cache: "no-store" })).json(); }
  catch { DELIV = {}; }
  await loadMultica();
  $("#upd").textContent = DATA.updated ? "updated " + DATA.updated : "";
  document.addEventListener("click", (e) => {
    const nav = e.target.closest(".nav a"); if (nav) return go(nav.dataset.id);
    const snap = e.target.closest("[data-go]"); if (snap) return go(snap.dataset.go);
  });
  $("#hamb").onclick = () => $("#side").classList.toggle("open");
  window.addEventListener("hashchange", () => go(location.hash.slice(1) || "overview"));
  go(location.hash.slice(1) || "overview");
}
boot();
