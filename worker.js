// Cloudflare Worker entry for the WeBuild site.
//
// The site is static assets served via the ASSETS binding. This Worker exists
// only to gate /mission-control/* behind a password + HMAC-signed session
// cookie. `run_worker_first: ["/mission-control/*"]` in wrangler.jsonc makes
// the Worker intercept ONLY those paths; every other asset (the whole
// marketing site) is served directly by the platform, unchanged.
//
// Required env vars (Cloudflare project → Settings → Variables, for the
// deployment env you review/ship): MC_PASSWORD (board login) and MC_SECRET
// (long random cookie-signing key). If MC_PASSWORD/MC_SECRET are unset, login
// always fails and nothing under /mission-control/ is served — fail closed.
//
// Optional Multica live data env vars: MULTICA_API_TOKEN (or MULTICA_TOKEN),
// MULTICA_WORKSPACE_ID, and optionally MULTICA_API_BASE_URL. The token is used
// only by the Worker; the browser sees normalized status data, never secrets.

const COOKIE = "mc_session";
const TTL = 60 * 60 * 12; // 12h
const MULTICA_DEFAULT_BASE = "https://api.multica.ai";

const enc = new TextEncoder();
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function makeToken(secret) {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  return `${exp}.${await hmac(secret, exp)}`;
}

export async function validToken(secret, token) {
  if (!token || !token.includes(".")) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

function readCookie(req, name) {
  const raw = req.headers.get("Cookie") || "";
  const hit = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function loginPage(error) {
  return new Response(LOGIN_HTML.replace("{{ERROR}}", error ? `<p class="err">${error}</p>` : ""), {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Returns a Response to short-circuit (login/redirect/logout), or null when the
// request is authenticated and the caller should serve the asset.
async function gate(request, env, url) {
  const secret = env.MC_SECRET;
  const password = env.MC_PASSWORD;

  if (url.pathname === "/mission-control/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/mission-control/",
        "Set-Cookie": `${COOKIE}=; Path=/mission-control; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    });
  }

  if (request.method === "POST" && url.pathname === "/mission-control/login") {
    if (!password || !secret) return loginPage("Auth not configured. Set MC_PASSWORD and MC_SECRET.");
    const form = await request.formData();
    if (!safeEqual(String(form.get("password") || ""), password)) return loginPage("Wrong password.");
    const token = await makeToken(secret);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/mission-control/",
        "Set-Cookie": `${COOKIE}=${encodeURIComponent(token)}; Path=/mission-control; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`,
      },
    });
  }

  if (secret && (await validToken(secret, readCookie(request, COOKIE)))) return null; // authed
  return loginPage(null);
}

function multicaConfig(env) {
  return {
    baseUrl: String(env.MULTICA_API_BASE_URL || env.MULTICA_SERVER_URL || MULTICA_DEFAULT_BASE).replace(/\/+$/, ""),
    token: env.MULTICA_API_TOKEN || env.MC_MULTICA_TOKEN || env.MULTICA_TOKEN,
    workspaceId: env.MULTICA_WORKSPACE_ID || env.MC_WORKSPACE_ID || env.WORKSPACE_ID,
    workspaceName: env.MULTICA_WORKSPACE_NAME || env.MC_WORKSPACE_NAME || "",
  };
}

async function multicaGet(cfg, path) {
  const res = await fetch(cfg.baseUrl + path, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cfg.token}`,
      "X-Workspace-ID": cfg.workspaceId,
    },
  });
  if (!res.ok) throw new Error(`Multica API returned ${res.status}`);
  return res.json();
}

const listOf = (value, key) => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
const countByStatus = (rows) => rows.reduce((out, row) => {
  const key = row.status || "unknown";
  out[key] = (out[key] || 0) + 1;
  return out;
}, {});
const BLOG_PROJECTS = new Set(["place", "social media growth"]);
const BLOG_MATCH = /\b(article|blog|seo|geo|publish|publishing|pillar|guide|keyword|educational content|content engine)\b/i;
const BLOG_COLUMNS = ["Idea", "Drafting", "Review", "Scheduled"];

function blogColumn(status) {
  return ({
    done: "Scheduled",
    completed: "Scheduled",
    in_review: "Review",
    blocked: "Review",
    in_progress: "Drafting",
    running: "Drafting",
    todo: "Idea",
    backlog: "Idea",
    planned: "Idea",
  }[String(status || "").toLowerCase()] || "Idea");
}

function isBlogIssue(issue) {
  const title = issue.title || "";
  if (/^content ideas\b/i.test(title)) return false;
  return BLOG_MATCH.test(`${title} ${issue.description || ""}`);
}

function normalizeBlogs(rows, projectsById, agentsById) {
  const seen = new Set();
  const cards = rows.filter(isBlogIssue).filter((issue) => {
    if (!issue.id || seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  }).sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))).map((issue) => {
    const project = projectsById.get(issue.project_id) || "";
    const status = issue.status || "unknown";
    return {
      id: issue.id,
      identifier: issue.identifier || (issue.number ? `#${issue.number}` : ""),
      title: issue.title || "Untitled content task",
      col: blogColumn(status),
      meta: [issue.identifier, status, project, agentsById.get(issue.assignee_id)].filter(Boolean).join(" · "),
      status,
      project,
      assignee: agentsById.get(issue.assignee_id) || "",
      updated_at: issue.updated_at || issue.created_at || null,
    };
  });
  return {
    live: true,
    source: "Multica",
    columns: BLOG_COLUMNS,
    cards,
  };
}

export function normalizeMultica({ projects, issues, agents, blogIssues = [], workspaceName = "" }) {
  const rawProjects = listOf(projects, "projects");
  const rawIssues = listOf(issues, "issues");
  const rawBlogIssues = listOf(blogIssues, "issues");
  const rawAgents = listOf(agents, "agents");
  const agentsById = new Map(rawAgents.map((a) => [a.id, a.name || "Agent"]));
  const projectsById = new Map(rawProjects.map((p) => [p.id, p.title || "Untitled project"]));
  const blogSourceIssues = [...rawBlogIssues, ...rawIssues.filter(isBlogIssue)];
  const safeBlogs = normalizeBlogs(blogSourceIssues, projectsById, agentsById);

  const safeProjects = rawProjects.map((p) => {
    const total = Number(p.issue_count || 0);
    const done = Number(p.done_count || 0);
    return {
      id: p.id,
      title: p.title || "Untitled project",
      status: p.status || "unknown",
      done_count: done,
      issue_count: total,
      progress: total ? Math.round((done / total) * 100) : 0,
      lead: agentsById.get(p.lead_id) || p.lead_type || "Unassigned",
      updated_at: p.updated_at || p.created_at || null,
      due_date: p.due_date || null,
      priority: p.priority || "none",
    };
  });

  const safeIssues = rawIssues.map((i) => ({
    id: i.id,
    identifier: i.identifier || (i.number ? `#${i.number}` : ""),
    title: i.title || "Untitled task",
    status: i.status || "unknown",
    assignee: agentsById.get(i.assignee_id) || (i.assignee_type ? i.assignee_type : "Unassigned"),
    project: projectsById.get(i.project_id) || "",
    updated_at: i.updated_at || i.created_at || null,
    due_date: i.due_date || null,
    priority: i.priority || "none",
  }));

  const safeAgents = rawAgents.map((a) => ({
    id: a.id,
    name: a.name || "Agent",
    role: a.description || a.runtime_mode || "",
    status: a.status || "unknown",
  }));

  return {
    ok: true,
    live: true,
    workspace: workspaceName || "Multica",
    updated: new Date().toISOString(),
    summary: {
      projects: safeProjects.length,
      tasks: Number(issues?.total || safeIssues.length),
      recent_tasks: safeIssues.length,
      agents: safeAgents.length,
      blogs: safeBlogs.cards.length,
      project_status: countByStatus(safeProjects),
      task_status: countByStatus(safeIssues),
    },
    projects: safeProjects,
    issues: safeIssues,
    agents: safeAgents,
    blogs: safeBlogs,
  };
}

async function multicaStatus(request, env) {
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const cfg = multicaConfig(env);
  if (!cfg.token || !cfg.workspaceId) {
    return json({
      ok: false,
      error: "missing_config",
      message: "Set MULTICA_API_TOKEN and MULTICA_WORKSPACE_ID in Cloudflare.",
    }, 503);
  }
  try {
    const [projects, issues, agents] = await Promise.all([
      multicaGet(cfg, "/api/projects"),
      multicaGet(cfg, "/api/issues?limit=100&offset=0&sort=created_at&direction=desc"),
      multicaGet(cfg, "/api/agents?include_archived=false"),
    ]);
    const blogProjectIds = listOf(projects, "projects")
      .filter((p) => BLOG_PROJECTS.has(String(p.title || "").toLowerCase()))
      .map((p) => p.id);
    const blogIssueSets = await Promise.all(blogProjectIds.map(async (id) => {
      try {
        return await multicaGet(cfg, `/api/issues?project=${encodeURIComponent(id)}&limit=60&offset=0&sort=created_at&direction=desc`);
      } catch {
        return [];
      }
    }));
    const blogIssues = blogIssueSets.flatMap((set) => listOf(set, "issues"));
    return json(normalizeMultica({ projects, issues, agents, blogIssues, workspaceName: cfg.workspaceName }));
  } catch (err) {
    return json({ ok: false, error: "api_error", message: err.message || "Multica API unavailable" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const gated = url.pathname === "/mission-control" || url.pathname.startsWith("/mission-control/");
    if (gated) {
      const resp = await gate(request, env, url);
      if (resp) return resp;
      if (url.pathname === "/mission-control/api/multica") return multicaStatus(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

const LOGIN_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mission Control — Sign in</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
:root{--obsidian:#09090b;--ink:#18181b;--slate:#52525b;--ash:#a1a1aa;--snow:#fff;--lime:#c8e636;--lime-deep:#aacb1f}
*{box-sizing:border-box}
body{margin:0;font-family:'DM Sans',system-ui,sans-serif;background:var(--obsidian);color:var(--snow);min-height:100vh;display:grid;place-items:center}
.card{width:min(92vw,380px);background:var(--ink);border:1px solid #27272a;border-radius:20px;padding:36px}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:18px;margin-bottom:24px}
.mark{width:26px;height:26px;border-radius:8px;background:var(--snow);display:grid;place-items:center}
.mark span{width:11px;height:11px;border-radius:3px;background:var(--lime)}
h1{font-size:20px;margin:0 0 4px}
p.sub{color:var(--ash);font-size:14px;margin:0 0 24px}
label{display:block;font-size:13px;color:var(--ash);margin-bottom:8px}
input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #3f3f46;background:var(--obsidian);color:var(--snow);font-size:15px;font-family:inherit}
input:focus{outline:none;border-color:var(--lime)}
button{width:100%;margin-top:16px;padding:12px;border:none;border-radius:12px;background:var(--lime);color:var(--obsidian);font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}
button:hover{background:var(--lime-deep)}
.err{color:#fca5a5;font-size:13px;margin:12px 0 0}
.foot{color:var(--slate);font-size:12px;margin-top:20px;text-align:center}
</style></head><body>
<form class="card" method="POST" action="/mission-control/login">
<div class="logo"><span class="mark"><span></span></span>WeBuild<span style="color:var(--slate);font-weight:400">Co</span></div>
<h1>Mission Control</h1><p class="sub">Board access only.</p>
<label for="pw">Password</label>
<input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
<button type="submit">Sign in</button>
{{ERROR}}
<div class="foot">WeBuild Agency · internal</div>
</form></body></html>`;
