// Server-side auth gate for /mission-control/* (Cloudflare Pages Function).
// Single board user. Password + HMAC-signed session cookie. No user store.
//
// Required env vars (set in Cloudflare Pages project settings, both Production
// and Preview): MC_PASSWORD (the board login password) and MC_SECRET (a long
// random string used to sign session cookies). If MC_PASSWORD is unset, login
// always fails and nothing under /mission-control/ is served — fail closed.
//
// ponytail: single shared password + signed cookie. Add per-user identity only
// if the board ever needs more than one login — Cloudflare Access is the drop-in
// upgrade (see PR notes) and needs zero code.

const COOKIE = "mc_session";
const TTL = 60 * 60 * 12; // 12h session

const enc = new TextEncoder();
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

// Constant-time-ish string compare.
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

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const secret = env.MC_SECRET;
  const password = env.MC_PASSWORD;

  // Handle logout.
  if (url.pathname.endsWith("/logout")) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/mission-control/",
        "Set-Cookie": `${COOKIE}=; Path=/mission-control; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    });
  }

  // Handle login POST.
  if (request.method === "POST" && url.pathname.endsWith("/login")) {
    if (!password || !secret) return loginPage("Auth not configured. Board must set MC_PASSWORD and MC_SECRET.");
    const form = await request.formData();
    const given = String(form.get("password") || "");
    if (!safeEqual(given, password)) return loginPage("Wrong password.");
    const token = await makeToken(secret);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/mission-control/",
        "Set-Cookie": `${COOKIE}=${encodeURIComponent(token)}; Path=/mission-control; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`,
      },
    });
  }

  // Authenticated? Serve the requested static asset.
  if (secret && (await validToken(secret, readCookie(request, COOKIE)))) {
    return next();
  }

  // Not authenticated → login screen (never serves protected assets).
  return loginPage(null);
}

const LOGIN_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mission Control — Sign in</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
:root{--obsidian:#09090b;--ink:#18181b;--slate:#52525b;--ash:#a1a1aa;--fog:#ececee;--snow:#fff;--lime:#c8e636;--lime-deep:#aacb1f}
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
