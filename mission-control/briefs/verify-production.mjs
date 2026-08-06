// Verify the deployed Mission Control brief without exposing board credentials.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { BRIEFS_PATH } from "./build-briefs.mjs";

// WEB-489. A spec site carries a real named business, so an invented customer
// quote on it is misleading conduct (ACL ss 18, 29(1)(e)) and the exposure is
// ours — we author and host the page. Two rules, both mechanical:
//   1. The layout may not assert a quotation. Quote characters come from data.
//   2. A REVIEW_*_TEXT value is only allowed when a human recorded where it was
//      copied from, in "_reviews_verified_source". Sentinels stay unshippable.
const STARTER = "client-sites-starter";
const SENTINEL = "{{UNSOURCED}}";

export function findUnsourcedTestimonials(root = STARTER) {
  const problems = [];
  if (!existsSync(root)) return problems;

  const template = `${root}/index.html`;
  if (existsSync(template) && /["'“‘]\s*\{\{REVIEW_\d_TEXT\}\}/.test(readFileSync(template, "utf8"))) {
    problems.push(`${template}: layout wraps {{REVIEW_n_TEXT}} in quote marks — the quote must come from the data`);
  }

  const files = [`${root}/content.example.json`];
  const prospects = `${root}/prospects`;
  if (existsSync(prospects)) {
    for (const dir of readdirSync(prospects)) files.push(`${prospects}/${dir}/content.json`);
  }

  for (const file of files.filter(existsSync)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    // The example is the blank the builder copies, so the sentinel is its correct
    // resting state. A prospect draft is a page we send someone — there the
    // sentinel means an unfilled quote slot is about to ship.
    const isExample = file.endsWith("content.example.json");
    const sourced = typeof data._reviews_verified_source === "string" && data._reviews_verified_source.trim();
    for (const [key, value] of Object.entries(data)) {
      if (!/^REVIEW_\d_TEXT$/.test(key) || typeof value !== "string" || !value.trim()) continue;
      if (value.trim() === SENTINEL) {
        if (!isExample) problems.push(`${file}: ${key} is still the ${SENTINEL} sentinel — paste verbatim review text or delete the reviews section`);
      } else if (!sourced) {
        problems.push(`${file}: ${key} has testimonial text with no "_reviews_verified_source" recording where it was copied from`);
      }
    }
  }
  return problems;
}

export function assertNoUnsourcedTestimonials(root = STARTER) {
  const problems = findUnsourcedTestimonials(root);
  if (problems.length) {
    throw new Error(`unsourced testimonial copy (WEB-489):\n  - ${problems.join("\n  - ")}`);
  }
  console.log("no unsourced testimonial copy in the spec-site starter");
}

const ORIGIN = (process.env.MC_BASE_URL || "https://webuildco.com.au").replace(/\/+$/, "");
const type = process.argv[2];

// Runs standalone so `npm test` gates the repo without needing production or a brief.
if (type === "--testimonials-only") {
  assertNoUnsourcedTestimonials();
  process.exit(0);
}

if (!type) throw new Error("usage: npm run briefs:verify -- <morning|eod|weekly|monthly|quarterly|yearly> | --testimonials-only");

assertNoUnsourcedTestimonials();

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const latest = (briefs) => briefs
  .filter((brief) => brief.type === type)
  .sort((a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || "")))[0];

const local = latest(readJson(BRIEFS_PATH));
if (!local) throw new Error(`no local ${type} brief found`);

const dataUrl = `${ORIGIN}/mission-control/data/briefs.json`;
const verifyHeaders = { Accept: "application/json", "Cache-Control": "no-cache" };
if (process.env.MC_VERIFY_TOKEN) verifyHeaders["X-Mission-Control-Verify"] = process.env.MC_VERIFY_TOKEN;

async function productionBriefs() {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const dataRes = await fetch(dataUrl, { headers: verifyHeaders, cache: "no-store" });
    const text = await dataRes.text();
    if (!dataRes.ok) lastError = new Error(`${dataUrl} returned ${dataRes.status}`);
    else {
      try {
        return JSON.parse(text);
      } catch (err) {
        lastError = new Error(`${dataUrl} did not return JSON (${dataRes.headers.get("content-type") || "no content-type"}): ${err.message}`);
      }
    }
    if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw lastError;
}

const remote = await productionBriefs();

const brief = Array.isArray(remote) && remote.find((item) => item.id === local.id && item.type === type);
if (!brief) throw new Error(`${local.id} missing from production briefs JSON`);

console.log(`${local.id} found in production briefs JSON; generated_at=${brief.generated_at}; wins=${(brief.wins || []).length}; next3=${(brief.next3 || []).length}`);

const shellUrl = `${ORIGIN}/mission-control/#/briefs`;
if (process.env.MC_PASSWORD) {
  const login = await fetch(`${ORIGIN}/mission-control/login`, {
    method: "POST",
    body: new URLSearchParams({ password: process.env.MC_PASSWORD }),
    redirect: "manual",
  });
  const cookie = login.headers.get("set-cookie");
  if (login.status !== 302 || !cookie) throw new Error(`Mission Control login returned ${login.status}`);

  const shell = await fetch(shellUrl, {
    headers: { Cookie: cookie.split(";")[0], "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  const html = await shell.text();
  if (!shell.ok || !html.includes("/mission-control/app.js")) throw new Error(`${shellUrl} did not load authenticated app shell`);
  console.log(`${shellUrl} loaded authenticated app shell`);
} else {
  const shell = await fetch(shellUrl, { headers: { "Cache-Control": "no-cache" }, cache: "no-store" });
  const html = await shell.text();
  if (!shell.ok || !html.includes("Board access only.")) throw new Error(`${shellUrl} did not return the expected sign-in page`);
  console.log(`${shellUrl} returns the expected unauthenticated sign-in page`);
}
