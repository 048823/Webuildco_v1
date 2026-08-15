#!/usr/bin/env node
// WEB-33. Uptime + schema monitor for the production homepage.
//
// A plain ping only proves the origin answered. The failure this is actually
// guarding against is a deploy that still returns 200 but has dropped or
// mangled the JSON-LD block — the site looks fine to a human and quietly stops
// being citable by search and AI crawlers. So the check asserts both.
//
// Run by .github/workflows/uptime.yml on a schedule; a non-zero exit is the
// alert. Escalation path is in the repo README.
import { setTimeout as sleep } from "node:timers/promises";

export const DEFAULT_URL = "https://www.webuildco.com.au/";

// Cloudflare in front of the site 403s some default library user-agents
// (python-urllib is blocked today), so the monitor names itself explicitly
// rather than inheriting whatever the runtime sends.
const USER_AGENT = "webuildco-uptime-check (+https://github.com/048823/Webuildco_v1)";
const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 5_000;

const LD_JSON_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// A JSON-LD document may be a single node, an array of nodes, or a @graph
// wrapper. All three are valid, so flatten before checking any one node.
function flatten(parsed) {
  if (Array.isArray(parsed)) return parsed.flatMap(flatten);
  if (parsed && typeof parsed === "object") {
    return Array.isArray(parsed["@graph"]) ? parsed["@graph"].flatMap(flatten) : [parsed];
  }
  return [];
}

// Deliberately asserts the SHAPE, not the exact values: @type and copy change
// when marketing changes, and a monitor that pages on a copy edit gets muted.
export function findSchemaProblems(html) {
  const blocks = [...String(html).matchAll(LD_JSON_RE)].map((m) => m[1].trim());
  if (blocks.length === 0) return ["no <script type=\"application/ld+json\"> block in the homepage HTML"];

  const problems = [];
  const nodes = [];
  for (const [i, block] of blocks.entries()) {
    try {
      nodes.push(...flatten(JSON.parse(block)));
    } catch (err) {
      problems.push(`JSON-LD block ${i + 1} does not parse as JSON: ${err.message}`);
    }
  }
  if (problems.length) return problems;

  const usable = nodes.filter(
    (n) =>
      typeof n?.["@context"] === "string" &&
      n["@context"].includes("schema.org") &&
      typeof n["@type"] === "string" &&
      n["@type"].trim() &&
      typeof n.name === "string" &&
      n.name.trim(),
  );
  if (usable.length === 0) {
    problems.push(
      `JSON-LD present but no node carries a schema.org @context plus a non-empty @type and name (found ${nodes.length} node(s))`,
    );
  }
  return problems;
}

async function fetchOnce(url) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ponytail: fixed 3 attempts / 5s apart. Enough to ride out a single network
// flap without muting a real outage; make it configurable only if the schedule
// starts producing false alerts.
export async function check(url = DEFAULT_URL) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const html = await fetchOnce(url);
      const problems = findSchemaProblems(html);
      if (problems.length) return { ok: false, url, reason: "schema", problems };
      return { ok: true, url, attempt };
    } catch (err) {
      lastError = err;
      if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  return { ok: false, url, reason: "unreachable", problems: [`unreachable after ${ATTEMPTS} attempts: ${lastError?.message}`] };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const url = process.env.TARGET_URL?.trim() || process.argv[2] || DEFAULT_URL;
  const result = await check(url);
  if (result.ok) {
    console.log(`OK ${url} — 200 and JSON-LD intact (attempt ${result.attempt})`);
  } else {
    console.error(`FAIL ${url} — ${result.reason}`);
    for (const p of result.problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}
