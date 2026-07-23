import { demoBackOfficeData } from "./back-office/demo-data.mjs";
import { PIPELINE_STATES, VERTICAL_CONFIGS, summarizeVertical } from "./back-office/model.mjs";

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
  escalation_flagged: "bad",
  expired: "bad",
  overdue: "bad",
  in_progress: "warn",
  in_review: "warn",
  waiting_on_client: "warn",
  waiting_on_candidate: "warn",
  document_received_partial: "warn",
  missing: "warn",
  requested: "warn",
  review_required: "warn",
  at_risk: "warn",
  drafted_email: "info",
  drafted_whatsapp: "info",
  intake: "info",
  document_collection: "info",
  compliance_check: "info",
  on_track: "info",
  ready_for_review: "ok",
  ready_outcome: "ok",
  received: "ok",
  met: "ok",
  todo: "info",
  planned: "info",
  backlog: "",
}[String(s || "").toLowerCase()] || "");
const labelize = (s) => String(s || "").replace(/_/g, " ");
const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};
const fmtDay = (s) => {
  if (!s) return "—";
  const d = new Date(String(s).includes("T") ? s : `${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short" }).format(d);
};

let DATA = {};
let CREATIVE = {}; // data/creative.json — owned by ECD, drives the Creative section
let BRIEFS = []; // data/briefs.json — generated from Board Reports / Daily Logs
let DOC_AGENT_STATE = null;
const DOC_AGENT_KEY = "mc_doc_agent_state_v2";
const DOC_AGENT_SOURCE = "shared_back_office_demo_v1";
const BACK_OFFICE_VERTICALS = Object.values(VERTICAL_CONFIGS);
const BACK_OFFICE_SUMMARIES = new Map(
  BACK_OFFICE_VERTICALS.flatMap((vertical) => summarizeVertical(demoBackOfficeData, vertical.id).map((row) => [row.id, row]))
);
const hasLiveBlogs = () => Boolean(DATA.multica?.live && DATA.multica?.blogs?.live);
const blogsData = () => hasLiveBlogs() ? DATA.multica.blogs : (DATA.blogs || { columns: [], cards: [] });
const hasLiveLeads = () => Boolean(DATA.multica?.live && DATA.multica?.leads?.live);
const leadsData = () => hasLiveLeads() ? DATA.multica.leads : (DATA.leads || { campaigns: [] });

// ---- Section definitions ----
const SECTIONS = [
  { id: "overview", title: "Overview", ic: "◫", desc: "Company at a glance — to-dos, briefs, live snapshot", flag: "manual", render: renderOverview },
  { id: "briefs", title: "Briefs", ic: "▥", desc: "Morning, EOD & cadence reports", flag: "manual", render: renderBriefs },
  { id: "projects", title: "Projects", ic: "▤", desc: "Client pipeline + internal projects", flag: "manual", render: renderProjects },
  { id: "doc-chaser", title: "Doc Chaser", ic: "□", desc: "Draft-only follow-ups, deadline flags, audit trail", flag: "manual", render: renderDocChaser },
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

function docAgent() {
  return window.DocumentAgent;
}

function loadDocAgentState() {
  const api = docAgent();
  if (!api) return { cases: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(DOC_AGENT_KEY) || "null");
    if (saved?.source === DOC_AGENT_SOURCE && saved?.cases?.length === demoBackOfficeData.cases.length) return saved;
  } catch {}
  return { source: DOC_AGENT_SOURCE, ...api.seedDocumentChaserState(demoBackOfficeData, { verticalConfigs: VERTICAL_CONFIGS }) };
}

function saveDocAgentState() {
  try { localStorage.setItem(DOC_AGENT_KEY, JSON.stringify(DOC_AGENT_STATE)); } catch {}
}

function currentDocAgentState() {
  if (!DOC_AGENT_STATE) DOC_AGENT_STATE = loadDocAgentState();
  return DOC_AGENT_STATE;
}

function setDocAgentState(next) {
  DOC_AGENT_STATE = next;
  saveDocAgentState();
}

function docContext(state) {
  const allCases = state.cases || [];
  const selected = allCases.find((item) => item.id === state.activeCaseId);
  const vertical = state.activeVertical || selected?.vertical || BACK_OFFICE_VERTICALS[0]?.id || "migration";
  const visibleCases = allCases.filter((item) => item.vertical === vertical);
  const active = visibleCases.find((item) => item.id === state.activeCaseId) || visibleCases[0] || allCases[0];
  return { allCases, visibleCases, active, vertical, config: VERTICAL_CONFIGS[active?.vertical || vertical] || {} };
}

function renderDocChaser() {
  const api = docAgent();
  if (!api) return `<div class="card"><p class="muted">Document simulator unavailable.</p></div>`;
  const state = currentDocAgentState();
  const { allCases, visibleCases, active, vertical, config } = docContext(state);
  if (!active) return `<div class="card"><p class="muted">No demo cases loaded.</p></div>`;

  const missing = api.missingDocuments(active);
  const action = active.lastAction || api.decideNextAction(active, { now: state.now, channel: active.preferredChannel });
  const firstMissing = missing[0];
  const totalMissing = allCases.reduce((sum, item) => sum + api.missingDocuments(item).length, 0);
  const ready = allCases.filter((item) => !api.missingDocuments(item).length).length;
  const flagged = new Set(allCases.filter((item) => item.status === "escalation_flagged" || item.lastAction?.type === "escalate" || api.decideNextAction(item, { now: state.now, channel: item.preferredChannel }).type === "escalate").map((item) => item.id)).size;
  const events = [...(active.auditEvents || [])].reverse();
  const summary = BACK_OFFICE_SUMMARIES.get(active.id);

  return `<div class="section-note"><b>Demo data:</b> Shared synthetic fixtures only. Email and WhatsApp providers stay in draft-only stub mode.</div>
  <div class="tabs">${BACK_OFFICE_VERTICALS.map((item) => `
    <button class="tab ${item.id === vertical ? "active" : ""}" data-doc-agent="vertical" data-vertical="${esc(item.id)}">${esc(item.name)}</button>
  `).join("")}</div>
  <div class="grid g4">
    ${statCard("Demo files", allCases.length, "6 shared records")}
    ${statCard("Missing docs", totalMissing, "required items")}
    ${statCard("Escalations", flagged, "deadline or repeat chase")}
    ${statCard("Ready files", ready, "review or outcome")}
  </div>
  <div class="doc-shell" style="margin-top:16px">
    <div class="card">
      <h3>${esc(config.name || "Demo records")} <span class="pill">${visibleCases.length}</span></h3>
      <div class="case-list">${visibleCases.map((item) => {
        const count = api.missingDocuments(item).length;
        const itemSummary = BACK_OFFICE_SUMMARIES.get(item.id);
        return `<button class="case-btn ${item.id === active.id ? "active" : ""}" data-doc-agent="select" data-case-id="${esc(item.id)}">
          <span><b>${esc(item.personName)}</b><span>${esc(item.reference)} · ${esc(itemSummary?.pipeline_label || item.pipelineLabel)}</span></span>
          <span class="badge ${count ? "warn" : "ok"}">${count ? `${count} missing` : "clear"}</span>
        </button>`;
      }).join("")}</div>
      <button class="btn ghost full" data-doc-agent="reset" style="margin-top:12px">Reset demo</button>
    </div>
    <div class="doc-main">
      <div class="card">
        <h3>${esc(active.reference)} · ${esc(active.personName)} <span class="badge ${statusCls(active.status)}">${esc(labelize(active.status))}</span></h3>
        <div class="doc-meta">
          <span>Tenant: ${esc(active.tenantId)}</span>
          <span>Owner: ${esc(active.ownerName)}</span>
          <span>${esc(config.unit?.reference || "Reference")}: ${esc(active.reference)}</span>
          <span>Deadline: ${esc(fmtDay(active.deadline))}</span>
          <span>Last contact: ${esc(fmtDate(active.lastContactAt))}</span>
        </div>
        ${renderDocPipeline(active, config)}
        <div class="doc-list">${active.documents.map((doc) => {
          const dueIn = api.daysUntil(doc.dueDate, state.now);
          const cls = doc.status === "received" ? "ok" : dueIn <= 3 ? "bad" : "warn";
          return `<div class="doc-row">
            <span><b>${esc(doc.label)}</b><span>Due ${esc(fmtDay(doc.dueDate))} · ${doc.followUpCount || 0} previous follow-up${(doc.followUpCount || 0) === 1 ? "" : "s"}</span></span>
            <span class="badge ${statusCls(doc.status) || cls}">${esc(labelize(doc.status))}</span>
          </div>`;
        }).join("")}</div>
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card">
          <h3>Next action <span class="badge ${action.severity}">${esc(action.headline)}</span></h3>
          <div class="doc-actions">
            <button class="btn primary" data-doc-agent="draft" data-case-id="${esc(active.id)}" data-channel="email">Draft email</button>
            <button class="btn ghost" data-doc-agent="draft" data-case-id="${esc(active.id)}" data-channel="whatsapp">Draft WhatsApp</button>
            <button class="btn ghost" data-doc-agent="reply" data-case-id="${esc(active.id)}" ${firstMissing ? `data-doc-id="${esc(firstMissing.id)}"` : "disabled"}>Mock reply</button>
          </div>
          <p class="muted tiny">${esc(action.auditEvent.reason)}</p>
          ${renderDraft(action)}
        </div>
        <div class="card">
          <h3>Deadline / compliance</h3>
          ${renderDeadlinePanel(active, config, summary)}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Audit trail <span class="pill">${events.length}</span></h3>
        <div class="audit-list">${events.map((event) => `
          <div class="audit-row">
            <span class="badge ${event.type === "escalate" ? "bad" : event.type === "mock_reply_received" ? "ok" : "info"}">${esc(labelize(event.type))}</span>
            <div><b>${esc(labelize(event.decision))}</b><span>${esc(event.reason)}</span><em>${esc(fmtDate(event.createdAt))} · external send: ${event.sentExternally ? "yes" : "no"}</em></div>
          </div>`).join("")}</div>
      </div>
    </div>
  </div>`;
}

function renderDocPipeline(active, config) {
  const labels = config.pipelineLabels || {};
  return `<div class="pipeline-steps">${PIPELINE_STATES.map((step) => {
    const done = PIPELINE_STATES.findIndex((row) => row.id === step.id) < PIPELINE_STATES.findIndex((row) => row.id === active.pipelineState);
    const current = step.id === active.pipelineState;
    return `<span class="${done ? "done" : ""} ${current ? "current" : ""}">${esc(labels[step.id] || step.label)}</span>`;
  }).join("")}</div>`;
}

function renderDeadlinePanel(active, config, summary) {
  const deadlines = active.deadlines || [];
  const rows = deadlines.length ? deadlines.map((deadline) => `
    <div class="deadline-row">
      <span><b>${esc(deadline.label)}</b><span>${esc(fmtDay(deadline.dueDate))}</span></span>
      <span class="badge ${statusCls(deadline.status)}">${esc(labelize(deadline.status))}</span>
    </div>`).join("") : `<p class="muted tiny">No open deadlines.</p>`;
  const constraints = (config.agentConstraints || []).map((item) => `<li>${esc(item)}</li>`).join("");
  return `${rows}
    <div class="compliance-box">
      <div><b>${esc(summary?.ready_label || active.readyLabel)}</b><span>${esc(summary?.pipeline_label || active.pipelineLabel)}</span></div>
      ${constraints ? `<ul>${constraints}</ul>` : ""}
    </div>`;
}

function renderDraft(action) {
  if (!action.draft) return `<div class="draft-box muted">No draft created for this decision.</div>`;
  return `<div class="draft-box">
    <div class="draft-head"><span class="badge info">${esc(action.channel)}</span><span class="badge warn">${esc(action.draft.providerMode.replace(/_/g, " "))}</span></div>
    ${action.draft.subject ? `<b>${esc(action.draft.subject)}</b>` : ""}
    <pre>${esc(action.draft.body)}</pre>
  </div>`;
}

function handleDocAgent(target) {
  const api = docAgent();
  if (!api) return;
  const state = currentDocAgentState();
  const action = target.dataset.docAgent;
  if (action === "select") {
    const item = (state.cases || []).find((row) => row.id === target.dataset.caseId);
    setDocAgentState({ ...state, activeCaseId: target.dataset.caseId, activeVertical: item?.vertical || state.activeVertical });
  } else if (action === "vertical") {
    const activeVertical = target.dataset.vertical;
    const active = (state.cases || []).find((row) => row.vertical === activeVertical);
    setDocAgentState({ ...state, activeVertical, activeCaseId: active?.id || state.activeCaseId });
  } else if (action === "draft") {
    setDocAgentState(api.runAgent(state, target.dataset.caseId, { channel: target.dataset.channel }));
  } else if (action === "reply") {
    setDocAgentState(api.applyMockReply(state, target.dataset.caseId, target.dataset.docId));
  } else if (action === "reset") {
    setDocAgentState({ source: DOC_AGENT_SOURCE, ...api.seedDocumentChaserState(demoBackOfficeData, { verticalConfigs: VERTICAL_CONFIGS }) });
  }
  go("doc-chaser");
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
  const localStatic = ["localhost", "127.0.0.1", "::1"].includes(location.hostname) && location.port === "8000";
  if (localStatic) {
    DATA.multica = { ...(DATA.multica || {}), live: false, error: "Local static preview; live Multica data loads through the Worker." };
    return;
  }
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
  try { BRIEFS = await (await fetch("/mission-control/data/briefs.json", { cache: "no-store" })).json(); if (!Array.isArray(BRIEFS)) BRIEFS = []; }
  catch { BRIEFS = []; }
  DOC_AGENT_STATE = loadDocAgentState();
  await loadMultica();
  $("#upd").textContent = DATA.updated ? "updated " + DATA.updated : "";
  document.addEventListener("click", (e) => {
    const agentControl = e.target.closest("[data-doc-agent]"); if (agentControl) return handleDocAgent(agentControl);
    const nav = e.target.closest(".nav a"); if (nav) return go(nav.dataset.id);
    const snap = e.target.closest("[data-go]"); if (snap) return go(snap.dataset.go);
  });
  $("#hamb").onclick = () => $("#side").classList.toggle("open");
  window.addEventListener("hashchange", () => go(location.hash.slice(1) || "overview"));
  go(location.hash.slice(1) || "overview");
}
boot();
