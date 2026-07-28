// Secret-safe production verifier for the Mission Control brief autopilots.

const DAILY_TYPES = new Set(["morning", "eod"]);

function arg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : "";
}

function sydYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function expectedBriefId() {
  const explicit = arg("--brief") || process.env.BRIEF_ID;
  if (explicit) return explicit;
  const type = (arg("--type") || process.env.BRIEF_TYPE || "").toLowerCase();
  if (!DAILY_TYPES.has(type)) throw new Error("pass --type morning|eod or --brief <brief-id>");
  return `${type}-${sydYmd()}`;
}

async function verify() {
  const brief = expectedBriefId();
  const base = (process.env.MC_BASE_URL || "https://webuildco.com.au").replace(/\/+$/, "");
  const url = `${base}/mission-control/api/deploy-health?brief=${encodeURIComponent(brief)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`deploy health returned non-JSON HTTP ${res.status}`);
  }
  if (!res.ok || !body.ok || !body.app_shell || !body.briefs_json || !body.brief?.present) {
    throw new Error(`deploy health failed for ${brief}: ${(body.errors || []).join(", ") || `HTTP ${res.status}`}`);
  }
  console.log(`deploy verified: ${brief} present; Mission Control app shell ok`);
}

verify().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
