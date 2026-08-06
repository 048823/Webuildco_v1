// Verify the deployed Mission Control brief without exposing board credentials.
import { readFileSync } from "node:fs";
import { BRIEFS_PATH } from "./build-briefs.mjs";

const ORIGIN = (process.env.MC_BASE_URL || "https://webuildco.com.au").replace(/\/+$/, "");
const type = process.argv[2];

if (!type) throw new Error("usage: npm run briefs:verify -- <morning|eod|weekly|monthly|quarterly|yearly>");

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
