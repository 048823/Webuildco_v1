const DEFAULT_BASE = "https://webuildco.com.au";
const DAILY_TYPES = new Set(["morning", "eod"]);
const PERIODIC_TYPES = new Set(["weekly", "monthly", "quarterly", "yearly"]);

function sydYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function expectedId() {
  if (process.env.BRIEF_VERIFY_ID) return process.env.BRIEF_VERIFY_ID;
  const arg = process.argv.slice(2).find((v) => !v.startsWith("-"));
  const type = arg || process.env.BRIEF_VERIFY_TYPE || process.env.BRIEF_TYPE || "eod";
  return /\d{4}-\d{2}-\d{2}$/.test(type) ? type : `${type}-${briefDate(type)}`;
}

function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function briefDate(type, now = new Date(), mode = process.env.BRIEF_PERIOD || "current") {
  if (DAILY_TYPES.has(type) || !PERIODIC_TYPES.has(type)) return sydYmd(now);
  const today = sydYmd(now);
  const [y, m, d] = today.split("-").map(Number);
  if (type === "weekly") {
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
    return addDays(today, (mode === "previous" ? -6 : 1) - day);
  }
  if (type === "monthly") {
    return new Date(Date.UTC(y, m - (mode === "previous" ? 1 : 0), 0)).toISOString().slice(0, 10);
  }
  if (type === "quarterly") {
    const q = Math.floor((m - 1) / 3) + 1;
    const currentStartMonth = (q - 1) * 3 + 1;
    return new Date(Date.UTC(y, currentStartMonth + (mode === "previous" ? 0 : 3) - 1, 0)).toISOString().slice(0, 10);
  }
  return `${mode === "previous" ? y - 1 : y}-12-31`;
}

function endpoint(base, path) {
  return new URL(path, base.replace(/\/+$/, "") + "/");
}

async function readJson(res, label) {
  try {
    return await res.json();
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

async function verifyBrief(base, id) {
  const url = endpoint(base, "/mission-control/api/briefs/verify");
  url.searchParams.set("id", id);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await readJson(res, "brief verification endpoint");
  if (!res.ok || body.ok !== true || body.present !== true || body.id !== id) {
    throw new Error(`brief ${id} not verified live: ${body.error || res.status}`);
  }
  console.log(`verified ${id} via public brief health (${body.generated_at || "no generated_at"})`);
}

async function verifyAuthedMissionControl(base, id) {
  const password = process.env.MC_VERIFY_PASSWORD || process.env.MC_PASSWORD;
  if (!password) {
    console.log("skipped authenticated Mission Control check: MC_VERIFY_PASSWORD not set");
    return;
  }

  const login = await fetch(endpoint(base, "/mission-control/login"), {
    method: "POST",
    body: new URLSearchParams({ password }),
    redirect: "manual",
  });
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  if (login.status !== 302 || !cookie) throw new Error("Mission Control login verification failed");

  const page = await fetch(endpoint(base, "/mission-control/"), { headers: { Cookie: cookie } });
  const html = await page.text();
  if (!page.ok || !html.includes("/mission-control/app.js")) throw new Error("Mission Control app shell did not load after auth");

  const briefsRes = await fetch(endpoint(base, "/mission-control/data/briefs.json"), {
    headers: { Accept: "application/json", Cookie: cookie },
  });
  const briefs = await readJson(briefsRes, "authenticated briefs.json");
  if (!briefsRes.ok || !Array.isArray(briefs) || !briefs.some((brief) => brief?.id === id)) {
    throw new Error(`authenticated briefs.json does not contain ${id}`);
  }
  console.log(`authenticated Mission Control shell and briefs.json verified for ${id}`);
}

const base = process.env.BRIEF_VERIFY_BASE_URL || DEFAULT_BASE;
const id = expectedId();

try {
  await verifyBrief(base, id);
  await verifyAuthedMissionControl(base, id);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
